#!/usr/bin/env node
/**
 * Update member_investments with real data from Memberstack custom fields.
 * Parses names, investment amounts, and calculates units from Memberstack metadata.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const MEMBERSTACK_SECRET_KEY = process.env.MEMBERSTACK_SECRET_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function parseCurrency(val) {
  if (!val) return 0;
  // Remove $, spaces, parentheses, and commas
  const cleaned = String(val).replace(/[$,\s()]/g, '').replace(/[^0-9.\-]/g, '');
  return parseFloat(cleaned) || 0;
}

async function fetchMemberstackMembers() {
  const url = new URL('https://admin.memberstack.com/members');
  url.searchParams.set('limit', '100');

  const response = await fetch(url.toString(), {
    headers: {
      'X-API-KEY': MEMBERSTACK_SECRET_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`API error: ${response.status}`);
    process.exit(1);
  }

  const data = await response.json();
  return data.data || data.members || data;
}

async function main() {
  const members = await fetchMemberstackMembers();
  console.log(`Processing ${members.length} members...\n`);

  // First, get fund metadata to calculate units
  const { data: fundMeta } = await supabase
    .from('fund_metadata')
    .select('*')
    .single();

  console.log('Fund metadata:', fundMeta);

  let totalInvested = 0;

  for (const m of members) {
    const id = m.id;
    const email = m.auth?.email || '';
    const firstName = m.customFields?.['first-name'] || '';
    const lastName = m.customFields?.['last-name'] || '';
    const name = `${firstName} ${lastName}`.trim() || email.split('@')[0];

    // Parse investment amount from custom fields
    const amountInvested = parseCurrency(m.customFields?.amountinvested || m.metaData?.AmountInvested);
    const portfolioValue = parseCurrency(m.customFields?.portfoliovalues || m.metaData?.PortfolioValueS);

    totalInvested += amountInvested;

    console.log(`  ${name} (${email})`);
    console.log(`    ID: ${id}`);
    console.log(`    Amount Invested: $${amountInvested.toFixed(2)}`);
    console.log(`    Portfolio Value: $${portfolioValue.toFixed(2)}`);

    // Update the record in Supabase
    const { error } = await supabase
      .from('member_investments')
      .update({
        member_name: name,
        member_email: email,
        amount_invested: amountInvested,
        investment_date: m.createdAt || new Date().toISOString(),
      })
      .eq('memberstack_id', id);

    if (error) {
      console.log(`    → Error: ${error.message}`);
    } else {
      console.log(`    → Updated`);
    }
  }

  console.log(`\n========================================`);
  console.log(`Total invested across all members: $${totalInvested.toFixed(2)}`);
  console.log(`========================================\n`);

  // Now calculate and assign units
  // NAV per Unit = Total AUM / Total Units Outstanding
  // For initial setup: if no units exist yet, set 1 unit = $1 or use the total
  // We'll set units_owned proportionally based on amount_invested

  if (totalInvested > 0) {
    // If fund_metadata doesn't have total_units, set it to match total invested (1 unit = $1 at inception)
    let totalUnits = fundMeta?.total_units_outstanding || 0;

    if (totalUnits === 0) {
      // Initialize: 1 unit = $1 at inception
      totalUnits = totalInvested;
      console.log(`Initializing total_units_outstanding to ${totalUnits} (1 unit = $1)`);

      const { error } = await supabase
        .from('fund_metadata')
        .update({ total_units_outstanding: totalUnits })
        .eq('id', fundMeta?.id);

      if (error) console.error('Error updating fund_metadata:', error.message);
    }

    // Assign units to each member
    console.log('\nAssigning units to members:');
    for (const m of members) {
      const id = m.id;
      const amountInvested = parseCurrency(m.customFields?.amountinvested || m.metaData?.AmountInvested);
      const name = `${m.customFields?.['first-name'] || ''} ${m.customFields?.['last-name'] || ''}`.trim() || m.auth?.email?.split('@')[0];

      // Units = Amount Invested / NAV per Unit
      // At inception NAV = 1.0, so units = amount
      const unitsOwned = amountInvested; // 1:1 at inception

      const { error } = await supabase
        .from('member_investments')
        .update({ units_owned: unitsOwned })
        .eq('memberstack_id', id);

      console.log(`  ${name}: $${amountInvested.toFixed(2)} → ${unitsOwned.toFixed(2)} units ${error ? '(Error: ' + error.message + ')' : '✓'}`);
    }
  }

  // Final summary
  const { data: allMembers } = await supabase
    .from('member_investments')
    .select('*')
    .order('member_name');

  console.log('\n========================================');
  console.log('Final member records in Supabase:');
  console.log('========================================');
  allMembers?.forEach(m => {
    console.log(`  ${m.member_name} | ${m.member_email} | $${m.amount_invested} invested | ${m.units_owned} units`);
  });
}

main().catch(console.error);
