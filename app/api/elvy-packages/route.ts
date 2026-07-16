import { NextRequest, NextResponse } from "next/server";

import {
  ElvyPackageRepository,
  type SaveElvyPackageInput,
} from "../../../services/supabase/elvy-package-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(
  message: string,
  status = 500,
  details?: unknown,
) {
  return NextResponse.json(
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
    { status },
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

export async function GET(request: NextRequest) {
  try {
    const packageId = request.nextUrl.searchParams.get("packageId")?.trim();

    if (packageId) {
      const packageDetails =
        await ElvyPackageRepository.getPackage(packageId);

      if (!packageDetails) {
        return jsonError("Elvy package was not found.", 404);
      }

      return NextResponse.json({
        success: true,
        package: packageDetails,
      });
    }

    const packages = await ElvyPackageRepository.listPackages();

    return NextResponse.json({
      success: true,
      packages,
      count: packages.length,
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

    return NextResponse.json(
      {
        success: true,
        action: "package-saved",
        message: `${saved.title} was saved to Elvy Cloud.`,
        package: saved,
      },
      { status: 201 },
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

    return NextResponse.json({
      success: true,
      action: "package-deleted",
      packageId,
      message: "The Elvy package and all linked curriculum data were deleted.",
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
