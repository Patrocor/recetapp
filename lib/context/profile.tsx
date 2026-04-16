"use client";

import { createContext, useContext } from "react";
import { DoctorProfile } from "@/types";

interface ProfileContextValue {
  profile: DoctorProfile;
  setProfile: (p: DoctorProfile) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export { ProfileContext };

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside AppShell");
  return ctx;
}
