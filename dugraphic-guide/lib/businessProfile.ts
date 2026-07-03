/*
 * Supabase SQL — see supabase/quotes.sql for the full create-table + RLS.
 *
 * create table if not exists business_profile (
 *   id boolean primary key default true check (id),  -- singleton row
 *   business_number text not null default '',
 *   company_name    text not null default '',
 *   owner_name      text not null default '',
 *   address         text not null default '',
 *   phone           text not null default '',
 *   email           text not null default '',
 *   bank_name       text not null default '',
 *   account_number  text not null default '',
 *   account_holder  text not null default '',
 *   updated_at      timestamptz not null default now()
 * );
 *
 * Owner-only read/write via RLS (see supabase/quotes.sql). This module
 * always uses the service-role admin client — callers (page.tsx / API
 * routes) must check requireOwnerOrForbidden()/getSessionUser() first.
 */

import { createAdminClient } from "@/lib/supabase-admin";

export interface BusinessProfile {
  businessNumber: string;
  companyName: string;
  ownerName: string;
  address: string;
  phone: string;
  email: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export async function getBusinessProfile(): Promise<BusinessProfile> {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("business_profile")
    .select(
      "business_number, company_name, owner_name, address, phone, email, bank_name, account_number, account_holder"
    )
    .eq("id", true)
    .single();
  if (error) throw new Error(`getBusinessProfile: ${error.message}`);
  return {
    businessNumber: data.business_number,
    companyName: data.company_name,
    ownerName: data.owner_name,
    address: data.address,
    phone: data.phone,
    email: data.email,
    bankName: data.bank_name,
    accountNumber: data.account_number,
    accountHolder: data.account_holder,
  };
}

export async function updateBusinessProfile(profile: BusinessProfile): Promise<void> {
  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from("business_profile")
    .update({
      business_number: profile.businessNumber,
      company_name: profile.companyName,
      owner_name: profile.ownerName,
      address: profile.address,
      phone: profile.phone,
      email: profile.email,
      bank_name: profile.bankName,
      account_number: profile.accountNumber,
      account_holder: profile.accountHolder,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) throw new Error(`updateBusinessProfile: ${error.message}`);
}
