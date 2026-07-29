import { NextRequest, NextResponse } from "next/server";

import {
  ElvyPackageRepository,
  type SaveElvyPackageInput,
} from "../../../services/supabase/elvy-package-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function jsonError(
  message: string,
  status = 500,
  details?: unknown,
) {
  return jsonResponse(
    {
      success: false,
      error: message,
      details:
        details instanceof Error
          ? {
              name: details.name,
              message: details.message,
            }
          : details || undefined,
    },
    status,
  );
}

function validateSavePayload(
  value: unknown,
): asserts value is SaveElvyPackageInput {
  if (!value || typeof value !== "object") {
    throw new Error("A valid package payload is required.");
  }

  const payload = value as Partial<SaveElvyPackageInput>;

  if (!payload.packageId?.trim()) {
    throw new Error("packageId is required.");
  }

  if (!payload.syllabusId?.trim()) {
    throw new Error("syllabusId is required.");
  }

  if (!payload.title?.trim()) {
    throw new Error("Package title is required.");
  }

  if (!payload.level || typeof payload.level !== "object") {
    throw new Error("A curriculum level is required.");
  }

  if (!payload.level.id?.trim()) {
    throw new Error("The curriculum level must have an id.");
  }

  if (!payload.level.title?.trim()) {
    throw new Error("The curriculum level must have a title.");
  }

  if (!Array.isArray(payload.level.sublevels)) {
    throw new Error("The curriculum level must contain a sublevels array.");
  }
}

type DashboardLesson = {
  id: string;
  title: string;
  label?: string;
  lessonNumber?: string;
  pageRange?: string;
  duration?: string;
  order?: number;
  theme?: string;
  cefrLevel?: string;
  schoolGrade?: string;
  lessonPlanData?: Record<string, unknown>;
  recordBookData?: Record<string, unknown>;
  blueprintData?: Record<string, unknown>;
  teachingAssets?: unknown[];
};

type DashboardPackage = {
  packageId: string;
  syllabusId: string;
  title: string;
  level: {
    id: string;
    title: string;
    sublevels: Array<{
      id: string;
      title: string;
      units: Array<{
        id: string;
        title: string;
        lessons: DashboardLesson[];
      }>;
    }>;
  };
  treeRecord?: {
    syllabusId?: string;
  };
};

function safeDecodeIdentifier(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function identifierVariants(value: string): Set<string> {
  const raw = safeDecodeIdentifier(String(value || "").trim());
  const variants = new Set<string>();

  if (!raw) return variants;

  const normalized = raw.toLowerCase();
  variants.add(normalized);

  const readyPackagePrefix = "ready-package:";

  if (normalized.startsWith(readyPackagePrefix)) {
    const withoutPrefix = normalized.slice(readyPackagePrefix.length).trim();

    if (withoutPrefix) {
      variants.add(withoutPrefix);
    }
  } else {
    variants.add(`${readyPackagePrefix}${normalized}`);
  }

  return variants;
}

function identifiersMatch(left: string, right: string): boolean {
  const leftVariants = identifierVariants(left);
  const rightVariants = identifierVariants(right);

  for (const value of leftVariants) {
    if (rightVariants.has(value)) return true;
  }

  return false;
}

function findDashboardPackage(
  packages: DashboardPackage[],
  packageId: string,
  syllabusId: string,
): DashboardPackage | null {
  const normalizedPackageId = packageId.trim();
  const normalizedSyllabusId = syllabusId.trim();

  /*
   * First preserve strict matching so the canonical package and syllabus
   * identifiers always win when both happen to be present.
   */
  if (normalizedPackageId) {
    const exactPackage = packages.find(
      (item) => item.packageId === normalizedPackageId,
    );

    if (exactPackage) return exactPackage;
  }

  if (normalizedSyllabusId) {
    const exactSyllabusPackage = packages.find(
      (item) =>
        item.syllabusId === normalizedSyllabusId ||
        item.treeRecord?.syllabusId === normalizedSyllabusId,
    );

    if (exactSyllabusPackage) return exactSyllabusPackage;
  }

  /*
   * The Lesson Plan Studio previously stored a package identifier in the
   * syllabusId query parameter. Resolve either incoming identifier against
   * every canonical package identifier so old and new URLs both work.
   */
  const requestedIdentifiers = [
    normalizedPackageId,
    normalizedSyllabusId,
  ].filter(Boolean);

  for (const item of packages) {
    const storedIdentifiers = [
      item.packageId,
      item.syllabusId,
      item.treeRecord?.syllabusId || "",
    ].filter(Boolean);

    const matches = requestedIdentifiers.some((requestedIdentifier) =>
      storedIdentifiers.some((storedIdentifier) =>
        identifiersMatch(requestedIdentifier, storedIdentifier),
      ),
    );

    if (matches) return item;
  }

  return null;
}

function findExactLessonContext(
  packageDetails: DashboardPackage,
  lessonId: string,
) {
  for (const sublevel of packageDetails.level.sublevels) {
    for (const unit of sublevel.units) {
      const lesson = unit.lessons.find(
        (item) => item.id === lessonId,
      );

      if (!lesson) continue;

      const lessonPlanData =
        lesson.lessonPlanData &&
        typeof lesson.lessonPlanData === "object" &&
        !Array.isArray(lesson.lessonPlanData)
          ? lesson.lessonPlanData
          : {};

      const blueprintData =
        lesson.blueprintData &&
        typeof lesson.blueprintData === "object" &&
        !Array.isArray(lesson.blueprintData)
          ? lesson.blueprintData
          : {};

      const blueprintStages = Array.isArray(blueprintData.stages)
        ? blueprintData.stages
        : Array.isArray(lessonPlanData.elvyBlueprint)
          ? lessonPlanData.elvyBlueprint
          : [];

      return {
        packageId: packageDetails.packageId,
        syllabusId: packageDetails.syllabusId,
        packageTitle: packageDetails.title,
        level: {
          id: packageDetails.level.id,
          title: packageDetails.level.title,
        },
        sublevel: {
          id: sublevel.id,
          title: sublevel.title,
        },
        unit: {
          id: unit.id,
          title: unit.title,
        },
        lesson: {
          ...lesson,
          id: lesson.id,
          lessonPlanData,
          recordBookData:
            lesson.recordBookData &&
            typeof lesson.recordBookData === "object" &&
            !Array.isArray(lesson.recordBookData)
              ? lesson.recordBookData
              : {},
          blueprintData,
          elvyBlueprint: blueprintStages,
          teachingAssets: Array.isArray(lesson.teachingAssets)
            ? lesson.teachingAssets
            : [],
        },
      };
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const packageId =
      request.nextUrl.searchParams.get("packageId")?.trim() || "";
    const syllabusId =
      request.nextUrl.searchParams.get("syllabusId")?.trim() || "";
    const lessonId =
      request.nextUrl.searchParams.get("lessonId")?.trim() || "";

    /*
     * Lesson requests must use the normalized dashboard package because it
     * rebuilds the Supabase hierarchy and attaches each teacher plan,
     * blueprint, record-book entry, and teaching asset to its exact lesson ID.
     */
    if (lessonId) {
      if (!packageId && !syllabusId) {
        return jsonError(
          "packageId or syllabusId is required when lessonId is provided.",
          400,
        );
      }

      const dashboardPackages =
        (await ElvyPackageRepository.listDashboardPackages()) as DashboardPackage[];

      const selectedPackage = findDashboardPackage(
        dashboardPackages,
        packageId,
        syllabusId,
      );

      if (!selectedPackage) {
        return jsonError(
          "The selected Elvy package was not found.",
          404,
        );
      }

      const lessonContext = findExactLessonContext(
        selectedPackage,
        lessonId,
      );

      if (!lessonContext) {
        return jsonError(
          `Lesson "${lessonId}" was not found inside package "${selectedPackage.packageId}".`,
          404,
        );
      }

      if (lessonContext.lesson.id !== lessonId) {
        return jsonError(
          "Lesson identity validation failed.",
          409,
        );
      }

      return jsonResponse({
        success: true,
        packageId: selectedPackage.packageId,
        syllabusId: selectedPackage.syllabusId,
        requestedLessonId: lessonId,
        returnedLessonId: lessonContext.lesson.id,
        lessonContext,
      });
    }

    if (packageId) {
      const packageDetails =
        await ElvyPackageRepository.getPackage(packageId);

      if (packageDetails) {
        return jsonResponse({
          success: true,
          package: packageDetails,
        });
      }

      /*
       * Support legacy URLs where a syllabus identifier, tree identifier, or
       * ready-package-prefixed identifier was sent as packageId.
       */
      const dashboardPackages =
        (await ElvyPackageRepository.listDashboardPackages()) as DashboardPackage[];

      const selectedPackage = findDashboardPackage(
        dashboardPackages,
        packageId,
        "",
      );

      if (!selectedPackage) {
        return jsonError("Elvy package was not found.", 404);
      }

      return jsonResponse({
        success: true,
        package: selectedPackage,
      });
    }

    if (syllabusId) {
      const dashboardPackages =
        (await ElvyPackageRepository.listDashboardPackages()) as DashboardPackage[];

      const selectedPackage = findDashboardPackage(
        dashboardPackages,
        "",
        syllabusId,
      );

      if (!selectedPackage) {
        return jsonError("Elvy package was not found.", 404);
      }

      return jsonResponse({
        success: true,
        package: selectedPackage,
      });
    }

    const dashboardPackages =
      await ElvyPackageRepository.listDashboardPackages();

    return jsonResponse({
      success: true,
      packages: dashboardPackages,
      count: dashboardPackages.length,
    });
  } catch (error) {
    console.error("[GET /api/elvy-packages] Failed:", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "Elvy packages could not be loaded.",
      500,
      error,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    validateSavePayload(payload);

    const saved = await ElvyPackageRepository.savePackage(payload);

    return jsonResponse(
      {
        success: true,
        action: "package-saved",
        message: `${saved.title} was saved to Elvy Cloud.`,
        package: saved,
      },
      201,
    );
  } catch (error) {
    console.error("[POST /api/elvy-packages] Failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "The Elvy package could not be saved.";

    const status =
      message.includes("required") ||
      message.includes("must have") ||
      message.includes("valid package")
        ? 400
        : 500;

    return jsonError(message, status, error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let packageId =
      request.nextUrl.searchParams.get("packageId")?.trim() || "";

    if (!packageId) {
      try {
        const payload = await request.json();
        packageId =
          typeof payload?.packageId === "string"
            ? payload.packageId.trim()
            : "";
      } catch {
        // Query-string deletion remains supported when no JSON body exists.
      }
    }

    if (!packageId) {
      return jsonError("packageId is required.", 400);
    }

    const deleted =
      await ElvyPackageRepository.deletePackage(packageId);

    if (!deleted) {
      return jsonError("Elvy package was not found.", 404);
    }

    return jsonResponse({
      success: true,
      action: "package-deleted",
      packageId,
      message:
        "The Elvy package and all linked curriculum data were deleted.",
    });
  } catch (error) {
    console.error("[DELETE /api/elvy-packages] Failed:", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "The Elvy package could not be deleted.",
      500,
      error,
    );
  }
}
