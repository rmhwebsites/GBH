/**
 * Utility to ensure total_units_outstanding in fund_metadata
 * ALWAYS matches the actual sum of member_investments.units_owned.
 *
 * This is the single source of truth for unit calculations.
 * No endpoint should ever set total_units to anything other than
 * the real sum of member units.
 */

import { SupabaseClient } from "@supabase/supabase-js";

interface UnitsVerification {
  totalMemberUnits: number;
  metadataUnits: number;
  matched: boolean;
  corrected: boolean;
}

/**
 * Get the verified total units outstanding.
 * Always queries member_investments to get the real sum.
 * If fund_metadata doesn't match, auto-corrects it and logs a warning.
 *
 * @returns The correct total units (from member_investments)
 */
export async function getVerifiedTotalUnits(
  supabase: SupabaseClient
): Promise<UnitsVerification> {
  // Get actual member units (the source of truth)
  const { data: members } = await supabase
    .from("member_investments")
    .select("units_owned");

  const totalMemberUnits =
    members?.reduce((sum, m) => sum + (m.units_owned || 0), 0) || 0;

  // Get what fund_metadata currently says
  const { data: metadata } = await supabase
    .from("fund_metadata")
    .select("id, total_units_outstanding")
    .limit(1)
    .single();

  const metadataUnits = metadata?.total_units_outstanding || 0;

  // Check if they match (within floating point tolerance)
  const tolerance = 0.01; // $0.01 worth of units
  const matched = Math.abs(totalMemberUnits - metadataUnits) < tolerance;

  let corrected = false;

  if (!matched && metadata) {
    // Auto-correct: fund_metadata is WRONG, member_investments is RIGHT
    console.warn(
      `[UNITS MISMATCH] fund_metadata.total_units_outstanding (${metadataUnits}) ` +
        `does not match sum of member_investments.units_owned (${totalMemberUnits}). ` +
        `Auto-correcting to ${totalMemberUnits}.`
    );

    await supabase
      .from("fund_metadata")
      .update({ total_units_outstanding: totalMemberUnits })
      .eq("id", metadata.id);

    corrected = true;
  }

  return {
    totalMemberUnits,
    metadataUnits,
    matched,
    corrected,
  };
}

/**
 * Update total_units_outstanding to match the actual member units.
 * Call this after any operation that modifies member_investments.
 */
export async function syncTotalUnits(
  supabase: SupabaseClient
): Promise<number> {
  const { data: members } = await supabase
    .from("member_investments")
    .select("units_owned");

  const totalMemberUnits =
    members?.reduce((sum, m) => sum + (m.units_owned || 0), 0) || 0;

  const { data: metadata } = await supabase
    .from("fund_metadata")
    .select("id")
    .limit(1)
    .single();

  if (metadata) {
    await supabase
      .from("fund_metadata")
      .update({ total_units_outstanding: totalMemberUnits })
      .eq("id", metadata.id);
  }

  return totalMemberUnits;
}
