"use client";

import Image from "next/image";
import {
  getMemberPhotoUrl,
  getInitials,
  getAvatarColor,
} from "@/lib/memberPhotos";

/** Avatar — shows the member photo if available, else initials */
export function MemberAvatar({
  name,
  size = "md",
  className = "",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const photoUrl = getMemberPhotoUrl(name);
  const sizeClasses = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-xs",
    lg: "h-12 w-12 sm:h-14 sm:w-14 text-sm sm:text-base",
  };

  if (photoUrl) {
    return (
      <div
        className={`relative flex-shrink-0 overflow-hidden rounded-full ${sizeClasses[size]} ${className}`}
      >
        <Image
          src={photoUrl}
          alt={name}
          fill
          className="object-cover"
          sizes={size === "sm" ? "28px" : size === "md" ? "36px" : "56px"}
          unoptimized
        />
      </div>
    );
  }

  const color = getAvatarColor(name);
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: color }}
    >
      {getInitials(name)}
    </div>
  );
}
