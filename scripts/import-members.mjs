#!/usr/bin/env node
/**
 * Import all members from Memberstack into Supabase member_investments table.
 *
 * Usage: node scripts/import-members.mjs
 *
 * Requires .env.local to be configured with:
 * - MEMBERSTACK_SECRET_KEY
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
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

if (!MEMBERSTACK_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables. Check .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fetchMemberstackMembers() {
  console.log('Fetching members from Memberstack...');

  let allMembers = [];
  let hasMore = true;
  let after = undefined;

  while (hasMore) {
    const url = new URL('https://admin.memberstack.com/members');
    url.searchParams.set('limit', '100');
    if (after) url.searchParams.set('after', after);

    const response = await fetch(url.toString(), {
      headers: {
        'X-API-KEY': MEMBERSTACK_SECRET_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Memberstack API error (${response.status}):`, errorText);

      // Try alternative API endpoint
      console.log('Trying alternative Memberstack API endpoint...');
      const altResponse = await fetch('https://api.memberstack.com/v1/members', {
        headers: {
          'Authorization': `Bearer ${MEMBERSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!altResponse.ok) {
        const altError = await altResponse.text();
        console.error(`Alternative API error (${altResponse.status}):`, altError);
        break;
      }

      const altData = await altResponse.json();
      console.log('Alternative API response:', JSON.stringify(altData, null, 2).slice(0, 500));
      if (altData.data) {
        allMembers = altData.data;
      } else if (Array.isArray(altData)) {
        allMembers = altData;
      } else if (altData.members) {
        allMembers = altData.members;
      }
      hasMore = false;
      break;
    }

    const data = await response.json();

    if (data.data && Array.isArray(data.data)) {
      allMembers = allMembers.concat(data.data);
    } else if (data.members && Array.isArray(data.members)) {
      allMembers = allMembers.concat(data.members);
    } else if (Array.isArray(data)) {
      allMembers = allMembers.concat(data);
    }

    // Check for pagination
    if (data.hasNextPage && data.endCursor) {
      after = data.endCursor;
    } else if (data.cursor) {
      after = data.cursor;
    } else {
      hasMore = false;
    }
  }

  return allMembers;
}

async function importToSupabase(members) {
  console.log(`\nImporting ${members.length} members to Supabase...\n`);

  // First check what's already in the database
  const { data: existing } = await supabase
    .from('member_investments')
    .select('memberstack_id');

  const existingIds = new Set((existing || []).map(e => e.memberstack_id));

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const member of members) {
    const memberId = member.id || member.memberId;
    const email = member.auth?.email || member.email || '';
    const name = member.customFields?.name ||
                 member.metaData?.name ||
                 member.profileData?.name ||
                 member.auth?.name ||
                 member.name ||
                 email.split('@')[0] ||
                 'Unknown';

    // Check for investment amount in custom fields or metadata
    const investmentAmount =
      parseFloat(member.customFields?.investmentAmount ||
                 member.customFields?.investment_amount ||
                 member.metaData?.investmentAmount ||
                 member.metaData?.investment_amount ||
                 member.customFields?.amount_invested ||
                 '0') || 0;

    const unitsOwned =
      parseFloat(member.customFields?.unitsOwned ||
                 member.customFields?.units_owned ||
                 member.metaData?.unitsOwned ||
                 member.metaData?.units_owned ||
                 '0') || 0;

    console.log(`  Member: ${name} (${email}) - ID: ${memberId}`);
    console.log(`    Investment: $${investmentAmount}, Units: ${unitsOwned}`);

    if (existingIds.has(memberId)) {
      console.log(`    → Skipped (already exists)`);
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('member_investments')
      .insert({
        memberstack_id: memberId,
        member_name: name,
        member_email: email,
        amount_invested: investmentAmount,
        units_owned: unitsOwned,
        investment_date: member.createdAt || member.created || new Date().toISOString(),
      });

    if (error) {
      console.log(`    → Error: ${error.message}`);
      errors++;
    } else {
      console.log(`    → Imported successfully`);
      imported++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Import Complete!`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped (existing): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total members in Memberstack: ${members.length}`);
  console.log(`========================================\n`);

  // Print all member IDs for admin configuration
  console.log('All Member IDs (for ADMIN_MEMBER_IDS in .env.local):');
  members.forEach(m => {
    const id = m.id || m.memberId;
    const name = m.customFields?.name || m.metaData?.name || m.auth?.email || m.email || 'Unknown';
    console.log(`  ${id} - ${name}`);
  });
}

async function main() {
  try {
    const members = await fetchMemberstackMembers();

    if (members.length === 0) {
      console.log('No members found in Memberstack. Check your API key.');
      return;
    }

    console.log(`\nFound ${members.length} members in Memberstack.`);
    console.log('\nRaw member data (first member):');
    console.log(JSON.stringify(members[0], null, 2));

    await importToSupabase(members);
  } catch (error) {
    console.error('Import failed:', error);
  }
}

main();
