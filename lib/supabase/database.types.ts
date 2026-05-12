export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bids: {
        Row: {
          bid_amount: number | null
          bid_document_url: string | null
          company_id: string
          converted_contract_id: string | null
          created_at: string
          decision_date: string | null
          estimated_units: number | null
          id: string
          landowner: string | null
          location: string | null
          name: string
          notes: string | null
          past_performance_notes: string | null
          site_notes: string | null
          status: Database["public"]["Enums"]["bid_status"]
          submitted_at: string | null
          unit_type: Database["public"]["Enums"]["unit_amount_type"] | null
          updated_at: string
          viewed_at: string | null
          viewed_by: string | null
          work_types: string[] | null
        }
        Insert: {
          bid_amount?: number | null
          bid_document_url?: string | null
          company_id: string
          converted_contract_id?: string | null
          created_at?: string
          decision_date?: string | null
          estimated_units?: number | null
          id?: string
          landowner?: string | null
          location?: string | null
          name: string
          notes?: string | null
          past_performance_notes?: string | null
          site_notes?: string | null
          status?: Database["public"]["Enums"]["bid_status"]
          submitted_at?: string | null
          unit_type?: Database["public"]["Enums"]["unit_amount_type"] | null
          updated_at?: string
          viewed_at?: string | null
          viewed_by?: string | null
          work_types?: string[] | null
        }
        Update: {
          bid_amount?: number | null
          bid_document_url?: string | null
          company_id?: string
          converted_contract_id?: string | null
          created_at?: string
          decision_date?: string | null
          estimated_units?: number | null
          id?: string
          landowner?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          past_performance_notes?: string | null
          site_notes?: string | null
          status?: Database["public"]["Enums"]["bid_status"]
          submitted_at?: string | null
          unit_type?: Database["public"]["Enums"]["unit_amount_type"] | null
          updated_at?: string
          viewed_at?: string | null
          viewed_by?: string | null
          work_types?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "bids_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_converted_contract_id_fkey"
            columns: ["converted_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      cardholder_employee_map: {
        Row: {
          cardholder_name: string
          created_at: string | null
          employee_id: string
          id: string
        }
        Insert: {
          cardholder_name: string
          created_at?: string | null
          employee_id: string
          id?: string
        }
        Update: {
          cardholder_name?: string
          created_at?: string | null
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cardholder_employee_map_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          ein: string | null
          flc_number: string | null
          flce_number: string | null
          id: string
          legal_name: string | null
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          ein?: string | null
          flc_number?: string | null
          flce_number?: string | null
          id?: string
          legal_name?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          ein?: string | null
          flc_number?: string | null
          flce_number?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      compliance_items: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["compliance_category"]
          company_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string
          id: string
          recurrence: string | null
          status: Database["public"]["Enums"]["compliance_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category: Database["public"]["Enums"]["compliance_category"]
          company_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          recurrence?: string | null
          status?: Database["public"]["Enums"]["compliance_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["compliance_category"]
          company_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          recurrence?: string | null
          status?: Database["public"]["Enums"]["compliance_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_items_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_contacts: {
        Row: {
          category: string | null
          contract_id: string | null
          created_at: string
          deleted_at: string | null
          email: string
          id: string
          name: string
          phone: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          contract_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          id?: string
          name: string
          phone?: string
          title?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          contract_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_contacts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_documents: {
        Row: {
          contract_id: string
          created_at: string
          doc_type: Database["public"]["Enums"]["contract_doc_type"]
          file_size_bytes: number | null
          id: string
          name: string
          notes: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          doc_type: Database["public"]["Enums"]["contract_doc_type"]
          file_size_bytes?: number | null
          id?: string
          name: string
          notes?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          doc_type?: Database["public"]["Enums"]["contract_doc_type"]
          file_size_bytes?: number | null
          id?: string
          name?: string
          notes?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          admin_notes: string | null
          amendment: string | null
          archived_at: string | null
          bags_per_tree_count: number | null
          bond_amount: number | null
          bond_paid: boolean | null
          company_id: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contract_number: string | null
          contract_price: number | null
          contract_type: Database["public"]["Enums"]["contract_type"] | null
          created_at: string
          display_id: string | null
          drive_folder_admin_id: string | null
          drive_folder_everyone_id: string | null
          elevation_max: number | null
          elevation_min: number | null
          end_date: string | null
          foreman_id: string | null
          fringe_rate: number | null
          has_fringe: boolean
          has_prevailing_wage: boolean
          id: string
          insurance_cgl_min: number | null
          landowner: string | null
          landowner_address: string | null
          location: string | null
          master_contract: string | null
          naics_code: string | null
          name: string
          notes: string | null
          parent_contract_id: string | null
          payment_terms: string | null
          prevailing_wage_rate: number | null
          prime_contractor: string | null
          services_checklist: Json | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          task_order: string | null
          total_acres: number | null
          total_seedlings: number | null
          total_units: number | null
          unit_type: Database["public"]["Enums"]["unit_amount_type"] | null
          updated_at: string
          vendor_number: string | null
          viewed_by: string | null
          work_types: string[]
        }
        Insert: {
          admin_notes?: string | null
          amendment?: string | null
          archived_at?: string | null
          bags_per_tree_count?: number | null
          bond_amount?: number | null
          bond_paid?: boolean | null
          company_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_number?: string | null
          contract_price?: number | null
          contract_type?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string
          display_id?: string | null
          drive_folder_admin_id?: string | null
          drive_folder_everyone_id?: string | null
          elevation_max?: number | null
          elevation_min?: number | null
          end_date?: string | null
          foreman_id?: string | null
          fringe_rate?: number | null
          has_fringe?: boolean
          has_prevailing_wage?: boolean
          id?: string
          insurance_cgl_min?: number | null
          landowner?: string | null
          landowner_address?: string | null
          location?: string | null
          master_contract?: string | null
          naics_code?: string | null
          name: string
          notes?: string | null
          parent_contract_id?: string | null
          payment_terms?: string | null
          prevailing_wage_rate?: number | null
          prime_contractor?: string | null
          services_checklist?: Json | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          task_order?: string | null
          total_acres?: number | null
          total_seedlings?: number | null
          total_units?: number | null
          unit_type?: Database["public"]["Enums"]["unit_amount_type"] | null
          updated_at?: string
          vendor_number?: string | null
          viewed_by?: string | null
          work_types?: string[]
        }
        Update: {
          admin_notes?: string | null
          amendment?: string | null
          archived_at?: string | null
          bags_per_tree_count?: number | null
          bond_amount?: number | null
          bond_paid?: boolean | null
          company_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_number?: string | null
          contract_price?: number | null
          contract_type?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string
          display_id?: string | null
          drive_folder_admin_id?: string | null
          drive_folder_everyone_id?: string | null
          elevation_max?: number | null
          elevation_min?: number | null
          end_date?: string | null
          foreman_id?: string | null
          fringe_rate?: number | null
          has_fringe?: boolean
          has_prevailing_wage?: boolean
          id?: string
          insurance_cgl_min?: number | null
          landowner?: string | null
          landowner_address?: string | null
          location?: string | null
          master_contract?: string | null
          naics_code?: string | null
          name?: string
          notes?: string | null
          parent_contract_id?: string | null
          payment_terms?: string | null
          prevailing_wage_rate?: number | null
          prime_contractor?: string | null
          services_checklist?: Json | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          task_order?: string | null
          total_acres?: number | null
          total_seedlings?: number | null
          total_units?: number | null
          unit_type?: Database["public"]["Enums"]["unit_amount_type"] | null
          updated_at?: string
          vendor_number?: string | null
          viewed_by?: string | null
          work_types?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_foreman_id_fkey"
            columns: ["foreman_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_parent_contract_id_fkey"
            columns: ["parent_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      county_wage_rates: {
        Row: {
          county: string
          created_at: string
          effective_date: string
          id: string
          rate: number
          source: string | null
          state: string
        }
        Insert: {
          county: string
          created_at?: string
          effective_date: string
          id?: string
          rate: number
          source?: string | null
          state: string
        }
        Update: {
          county?: string
          created_at?: string
          effective_date?: string
          id?: string
          rate?: number
          source?: string | null
          state?: string
        }
        Relationships: []
      }
      crew_set_members: {
        Row: {
          created_at: string
          crew_set_id: string
          employee_id: string
          id: string
          is_default: boolean
        }
        Insert: {
          created_at?: string
          crew_set_id: string
          employee_id: string
          id?: string
          is_default?: boolean
        }
        Update: {
          created_at?: string
          crew_set_id?: string
          employee_id?: string
          id?: string
          is_default?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "crew_set_members_crew_set_id_fkey"
            columns: ["crew_set_id"]
            isOneToOne: false
            referencedRelation: "crew_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_set_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_sets: {
        Row: {
          created_at: string
          foreman_id: string
          id: string
          is_default: boolean
          last_used_at: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          foreman_id: string
          id?: string
          is_default?: boolean
          last_used_at?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          foreman_id?: string
          id?: string
          is_default?: boolean
          last_used_at?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_sets_foreman_id_fkey"
            columns: ["foreman_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverable_invoice_lines: {
        Row: {
          created_at: string | null
          description: string
          id: string
          is_out_of_scope: boolean | null
          item_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          is_out_of_scope?: boolean | null
          item_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          is_out_of_scope?: boolean | null
          item_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_invoice_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "deliverable_items"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverable_invoice_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          invoice_field: string
          item_id: string
          new_status: string
          old_status: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          invoice_field: string
          item_id: string
          new_status: string
          old_status?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          invoice_field?: string
          item_id?: string
          new_status?: string
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_invoice_log_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "deliverable_items"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverable_items: {
        Row: {
          bid_price_cents: number | null
          bid_status: string | null
          build_notes_md: string | null
          created_at: string | null
          discovery_plan_md: string | null
          due_date: string | null
          guide_md: string | null
          health_status: string | null
          id: string
          invoice_amount: number | null
          invoice_drive_file_id: string | null
          invoice_final_drive_file_id: string | null
          invoice_final_status: string | null
          invoice_kickoff_status: string | null
          invoice_notes_md: string | null
          invoice_number: string | null
          invoice_paid_at: string | null
          invoice_sent_at: string | null
          invoice_status: string | null
          is_in_flight: boolean
          is_out_of_scope_card: boolean | null
          item_key: string
          item_number: string | null
          scope_md: string | null
          sort_order: number
          status: string
          subtitle: string | null
          tab: string
          title: string
          updated_at: string | null
          work_state: string | null
        }
        Insert: {
          bid_price_cents?: number | null
          bid_status?: string | null
          build_notes_md?: string | null
          created_at?: string | null
          discovery_plan_md?: string | null
          due_date?: string | null
          guide_md?: string | null
          health_status?: string | null
          id?: string
          invoice_amount?: number | null
          invoice_drive_file_id?: string | null
          invoice_final_drive_file_id?: string | null
          invoice_final_status?: string | null
          invoice_kickoff_status?: string | null
          invoice_notes_md?: string | null
          invoice_number?: string | null
          invoice_paid_at?: string | null
          invoice_sent_at?: string | null
          invoice_status?: string | null
          is_in_flight?: boolean
          is_out_of_scope_card?: boolean | null
          item_key: string
          item_number?: string | null
          scope_md?: string | null
          sort_order?: number
          status?: string
          subtitle?: string | null
          tab: string
          title: string
          updated_at?: string | null
          work_state?: string | null
        }
        Update: {
          bid_price_cents?: number | null
          bid_status?: string | null
          build_notes_md?: string | null
          created_at?: string | null
          discovery_plan_md?: string | null
          due_date?: string | null
          guide_md?: string | null
          health_status?: string | null
          id?: string
          invoice_amount?: number | null
          invoice_drive_file_id?: string | null
          invoice_final_drive_file_id?: string | null
          invoice_final_status?: string | null
          invoice_kickoff_status?: string | null
          invoice_notes_md?: string | null
          invoice_number?: string | null
          invoice_paid_at?: string | null
          invoice_sent_at?: string | null
          invoice_status?: string | null
          is_in_flight?: boolean
          is_out_of_scope_card?: boolean | null
          item_key?: string
          item_number?: string | null
          scope_md?: string | null
          sort_order?: number
          status?: string
          subtitle?: string | null
          tab?: string
          title?: string
          updated_at?: string | null
          work_state?: string | null
        }
        Relationships: []
      }
      deliverable_questions: {
        Row: {
          answer_md: string | null
          answered_at: string | null
          answered_by: string | null
          category: string | null
          created_at: string | null
          id: string
          item_id: string
          question_md: string
          sort_order: number
          status: string
          updated_at: string | null
        }
        Insert: {
          answer_md?: string | null
          answered_at?: string | null
          answered_by?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          item_id: string
          question_md: string
          sort_order?: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          answer_md?: string | null
          answered_at?: string | null
          answered_by?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          item_id?: string
          question_md?: string
          sort_order?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_questions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "deliverable_items"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          created_at: string
          doc_type: Database["public"]["Enums"]["employee_doc_type"]
          employee_id: string
          expiration_date: string | null
          id: string
          name: string
          notes: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type: Database["public"]["Enums"]["employee_doc_type"]
          employee_id: string
          expiration_date?: string | null
          id?: string
          name: string
          notes?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: Database["public"]["Enums"]["employee_doc_type"]
          employee_id?: string
          expiration_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address_home: string | null
          address_us: string | null
          company_auth: Database["public"]["Enums"]["company_auth_type"]
          cpr_exp: string | null
          created_at: string
          daily_rate: number | null
          dl_exp: string | null
          drive_auth_exp: string | null
          email: string | null
          fingerprints_exp: string | null
          first_name: string
          herbicide_license_exp: string | null
          id: string
          is_driver: boolean
          is_foreman: boolean
          is_h2b: boolean
          is_office: boolean
          last_name: string
          min_county_rate: number | null
          notes: string | null
          passport_exp: string | null
          phone: string | null
          rate: number | null
          rate_type: Database["public"]["Enums"]["rate_type"]
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
          user_id: string | null
          visa_exp: string | null
        }
        Insert: {
          address_home?: string | null
          address_us?: string | null
          company_auth?: Database["public"]["Enums"]["company_auth_type"]
          cpr_exp?: string | null
          created_at?: string
          daily_rate?: number | null
          dl_exp?: string | null
          drive_auth_exp?: string | null
          email?: string | null
          fingerprints_exp?: string | null
          first_name: string
          herbicide_license_exp?: string | null
          id?: string
          is_driver?: boolean
          is_foreman?: boolean
          is_h2b?: boolean
          is_office?: boolean
          last_name: string
          min_county_rate?: number | null
          notes?: string | null
          passport_exp?: string | null
          phone?: string | null
          rate?: number | null
          rate_type?: Database["public"]["Enums"]["rate_type"]
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          user_id?: string | null
          visa_exp?: string | null
        }
        Update: {
          address_home?: string | null
          address_us?: string | null
          company_auth?: Database["public"]["Enums"]["company_auth_type"]
          cpr_exp?: string | null
          created_at?: string
          daily_rate?: number | null
          dl_exp?: string | null
          drive_auth_exp?: string | null
          email?: string | null
          fingerprints_exp?: string | null
          first_name?: string
          herbicide_license_exp?: string | null
          id?: string
          is_driver?: boolean
          is_foreman?: boolean
          is_h2b?: boolean
          is_office?: boolean
          last_name?: string
          min_county_rate?: number | null
          notes?: string | null
          passport_exp?: string | null
          phone?: string | null
          rate?: number | null
          rate_type?: Database["public"]["Enums"]["rate_type"]
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          user_id?: string | null
          visa_exp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_audit_log: {
        Row: {
          action: string
          created_at: string | null
          expense_id: string
          field_changed: string | null
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          expense_id: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          expense_id?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_audit_log_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_audit_log_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "v_expense_auto_matches"
            referencedColumns: ["expense_id"]
          },
        ]
      }
      expense_imports: {
        Row: {
          auto_matched_count: number
          created_at: string | null
          error_count: number
          error_log: Json | null
          id: string
          imported_at: string
          imported_by: string | null
          imported_count: number
          row_count: number
          skipped_count: number
          spreadsheet_id: string
          status: string
          tab_gid: string | null
          tab_name: string
        }
        Insert: {
          auto_matched_count?: number
          created_at?: string | null
          error_count?: number
          error_log?: Json | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          imported_count?: number
          row_count?: number
          skipped_count?: number
          spreadsheet_id: string
          status?: string
          tab_gid?: string | null
          tab_name: string
        }
        Update: {
          auto_matched_count?: number
          created_at?: string | null
          error_count?: number
          error_log?: Json | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          imported_count?: number
          row_count?: number
          skipped_count?: number
          spreadsheet_id?: string
          status?: string
          tab_gid?: string | null
          tab_name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amex_category_raw: string | null
          amount: number
          assigned_at: string | null
          assigned_by: string | null
          card_company: string | null
          card_last4: string | null
          cardholder_name: string | null
          category: Database["public"]["Enums"]["expense_category"]
          city_state: string | null
          company_id: string | null
          contract_id: string | null
          contract_number: string | null
          created_at: string
          crew_member: string | null
          date: string
          deleted_at: string | null
          description: string | null
          display_id: string | null
          employee_id: string | null
          equipment_item_id: string | null
          fuel_purchase_id: string | null
          hotel_stay_id: string | null
          id: string
          import_batch_id: string | null
          import_timestamp: string | null
          is_recurring: boolean | null
          is_reimbursable: boolean | null
          location_city: string | null
          location_lat: number | null
          location_long: number | null
          location_state: string | null
          match_confidence: number | null
          match_method: string | null
          notes: string | null
          odometer_end: number | null
          odometer_start: number | null
          payment_method: string | null
          post_date: string | null
          quality_flags: string[] | null
          raw_row_hash: string | null
          receipt_url: string | null
          source: Database["public"]["Enums"]["expense_source"]
          source_file: string | null
          statement_description: string | null
          subcategory: string | null
          tags: string[] | null
          transaction_type: string
          updated_at: string
          vehicle_id: string | null
          vendor: string | null
          work_date: string | null
        }
        Insert: {
          amex_category_raw?: string | null
          amount: number
          assigned_at?: string | null
          assigned_by?: string | null
          card_company?: string | null
          card_last4?: string | null
          cardholder_name?: string | null
          category: Database["public"]["Enums"]["expense_category"]
          city_state?: string | null
          company_id?: string | null
          contract_id?: string | null
          contract_number?: string | null
          created_at?: string
          crew_member?: string | null
          date: string
          deleted_at?: string | null
          description?: string | null
          display_id?: string | null
          employee_id?: string | null
          equipment_item_id?: string | null
          fuel_purchase_id?: string | null
          hotel_stay_id?: string | null
          id?: string
          import_batch_id?: string | null
          import_timestamp?: string | null
          is_recurring?: boolean | null
          is_reimbursable?: boolean | null
          location_city?: string | null
          location_lat?: number | null
          location_long?: number | null
          location_state?: string | null
          match_confidence?: number | null
          match_method?: string | null
          notes?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          payment_method?: string | null
          post_date?: string | null
          quality_flags?: string[] | null
          raw_row_hash?: string | null
          receipt_url?: string | null
          source?: Database["public"]["Enums"]["expense_source"]
          source_file?: string | null
          statement_description?: string | null
          subcategory?: string | null
          tags?: string[] | null
          transaction_type?: string
          updated_at?: string
          vehicle_id?: string | null
          vendor?: string | null
          work_date?: string | null
        }
        Update: {
          amex_category_raw?: string | null
          amount?: number
          assigned_at?: string | null
          assigned_by?: string | null
          card_company?: string | null
          card_last4?: string | null
          cardholder_name?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          city_state?: string | null
          company_id?: string | null
          contract_id?: string | null
          contract_number?: string | null
          created_at?: string
          crew_member?: string | null
          date?: string
          deleted_at?: string | null
          description?: string | null
          display_id?: string | null
          employee_id?: string | null
          equipment_item_id?: string | null
          fuel_purchase_id?: string | null
          hotel_stay_id?: string | null
          id?: string
          import_batch_id?: string | null
          import_timestamp?: string | null
          is_recurring?: boolean | null
          is_reimbursable?: boolean | null
          location_city?: string | null
          location_lat?: number | null
          location_long?: number | null
          location_state?: string | null
          match_confidence?: number | null
          match_method?: string | null
          notes?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          payment_method?: string | null
          post_date?: string | null
          quality_flags?: string[] | null
          raw_row_hash?: string | null
          receipt_url?: string | null
          source?: Database["public"]["Enums"]["expense_source"]
          source_file?: string | null
          statement_description?: string | null
          subcategory?: string | null
          tags?: string[] | null
          transaction_type?: string
          updated_at?: string
          vehicle_id?: string | null
          vendor?: string | null
          work_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "expense_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      foreman_favorites: {
        Row: {
          added_by: string | null
          contract_id: string
          created_at: string | null
          employee_id: string
          id: string
        }
        Insert: {
          added_by?: string | null
          contract_id: string
          created_at?: string | null
          employee_id: string
          id?: string
        }
        Update: {
          added_by?: string | null
          contract_id?: string
          created_at?: string | null
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "foreman_favorites_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foreman_favorites_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          contract_id: string | null
          created_at: string
          date: string
          description: string
          employee_id: string | null
          follow_up: string | null
          id: string
          osha_reportable: boolean
          photos: string[] | null
          reported_by: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          type: Database["public"]["Enums"]["incident_type"]
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          date: string
          description: string
          employee_id?: string | null
          follow_up?: string | null
          id?: string
          osha_reportable?: boolean
          photos?: string[] | null
          reported_by?: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          type: Database["public"]["Enums"]["incident_type"]
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          date?: string
          description?: string
          employee_id?: string | null
          follow_up?: string | null
          id?: string
          osha_reportable?: boolean
          photos?: string[] | null
          reported_by?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          type?: Database["public"]["Enums"]["incident_type"]
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_periods: {
        Row: {
          company_id: string
          created_at: string
          end_date: string
          exported_at: string | null
          exported_by: string | null
          id: string
          start_date: string
          status: Database["public"]["Enums"]["pay_period_status"]
          total_gross: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          end_date: string
          exported_at?: string | null
          exported_by?: string | null
          id?: string
          start_date: string
          status?: Database["public"]["Enums"]["pay_period_status"]
          total_gross?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          end_date?: string
          exported_at?: string | null
          exported_by?: string | null
          id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["pay_period_status"]
          total_gross?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_periods_exported_by_fkey"
            columns: ["exported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_method_company_map: {
        Row: {
          card_identifier: string
          company_id: string | null
          created_at: string | null
          id: string
          label: string | null
        }
        Insert: {
          card_identifier: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          label?: string | null
        }
        Update: {
          card_identifier?: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_method_company_map_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_summary: {
        Row: {
          created_at: string
          employee_id: string
          fringe_total: number | null
          id: string
          pay_period_id: string
          rate_used: number | null
          total_drive_hours: number | null
          total_gross: number | null
          total_ot_hours: number | null
          total_reg_hours: number | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          fringe_total?: number | null
          id?: string
          pay_period_id: string
          rate_used?: number | null
          total_drive_hours?: number | null
          total_gross?: number | null
          total_ot_hours?: number | null
          total_reg_hours?: number | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          fringe_total?: number | null
          id?: string
          pay_period_id?: string
          rate_used?: number | null
          total_drive_hours?: number | null
          total_gross?: number | null
          total_ot_hours?: number | null
          total_reg_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_summary_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_summary_pay_period_id_fkey"
            columns: ["pay_period_id"]
            isOneToOne: false
            referencedRelation: "pay_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      prevailing_wage_rates: {
        Row: {
          bls_area: string | null
          company_id: string
          county: string
          created_at: string | null
          hourly_rate: number
          id: string
          pwd_case_number: string | null
          soc_code: string | null
          state: string
          updated_at: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          bls_area?: string | null
          company_id: string
          county: string
          created_at?: string | null
          hourly_rate: number
          id?: string
          pwd_case_number?: string | null
          soc_code?: string | null
          state: string
          updated_at?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          bls_area?: string | null
          company_id?: string
          county?: string
          created_at?: string | null
          hourly_rate?: number
          id?: string
          pwd_case_number?: string | null
          soc_code?: string | null
          state?: string
          updated_at?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prevailing_wage_rates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      production_logs: {
        Row: {
          created_at: string
          gps_boundary: Json | null
          id: string
          is_estimate: boolean
          notes: string | null
          quantity: number | null
          quantity_type: Database["public"]["Enums"]["production_type"] | null
          timesheet_id: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          gps_boundary?: Json | null
          id?: string
          is_estimate?: boolean
          notes?: string | null
          quantity?: number | null
          quantity_type?: Database["public"]["Enums"]["production_type"] | null
          timesheet_id: string
          unit_id: string
        }
        Update: {
          created_at?: string
          gps_boundary?: Json | null
          id?: string
          is_estimate?: boolean
          notes?: string | null
          quantity?: number | null
          quantity_type?: Database["public"]["Enums"]["production_type"] | null
          timesheet_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_logs_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_meetings: {
        Row: {
          attendees: string[] | null
          contract_id: string | null
          created_at: string
          date: string
          document_url: string | null
          id: string
          notes: string | null
          topic: string
        }
        Insert: {
          attendees?: string[] | null
          contract_id?: string | null
          created_at?: string
          date: string
          document_url?: string | null
          id?: string
          notes?: string | null
          topic: string
        }
        Update: {
          attendees?: string[] | null
          contract_id?: string | null
          created_at?: string
          date?: string
          document_url?: string | null
          id?: string
          notes?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_meetings_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_category_map: {
        Row: {
          created_at: string | null
          expense_category: string
          id: string
          sheet_category: string
        }
        Insert: {
          created_at?: string | null
          expense_category: string
          id?: string
          sheet_category: string
        }
        Update: {
          created_at?: string | null
          expense_category?: string
          id?: string
          sheet_category?: string
        }
        Relationships: []
      }
      timesheet_entries: {
        Row: {
          bags_count: number | null
          created_at: string
          drive_hours: number | null
          drive_rate: number | null
          dt_hours: number | null
          employee_id: string
          employee_note: string | null
          fringe_amount: number | null
          gross_pay: number | null
          hours_worked: number | null
          id: string
          is_present: boolean
          min_county_rate: number | null
          ot_hours: number | null
          rate_applied: number | null
          timesheet_id: string
          work_type: string | null
        }
        Insert: {
          bags_count?: number | null
          created_at?: string
          drive_hours?: number | null
          drive_rate?: number | null
          dt_hours?: number | null
          employee_id: string
          employee_note?: string | null
          fringe_amount?: number | null
          gross_pay?: number | null
          hours_worked?: number | null
          id?: string
          is_present?: boolean
          min_county_rate?: number | null
          ot_hours?: number | null
          rate_applied?: number | null
          timesheet_id: string
          work_type?: string | null
        }
        Update: {
          bags_count?: number | null
          created_at?: string
          drive_hours?: number | null
          drive_rate?: number | null
          dt_hours?: number | null
          employee_id?: string
          employee_note?: string | null
          fringe_amount?: number | null
          gross_pay?: number | null
          hours_worked?: number | null
          id?: string
          is_present?: boolean
          min_county_rate?: number | null
          ot_hours?: number | null
          rate_applied?: number | null
          timesheet_id?: string
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          photo_file_id: string
          photo_url: string | null
          reviewed_by: string | null
          status: string | null
          telegram_user_id: string
          telegram_username: string | null
          updated_at: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          photo_file_id: string
          photo_url?: string | null
          reviewed_by?: string | null
          status?: string | null
          telegram_user_id: string
          telegram_username?: string | null
          updated_at?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          photo_file_id?: string
          photo_url?: string | null
          reviewed_by?: string | null
          status?: string | null
          telegram_user_id?: string
          telegram_username?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_photos_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_unit_hours: {
        Row: {
          completed_at_time: string | null
          created_at: string
          hours_on_unit: number
          id: string
          status_at_submit: Database["public"]["Enums"]["daily_unit_status"]
          timesheet_id: string
          unit_id: string
          unit_note: string | null
        }
        Insert: {
          completed_at_time?: string | null
          created_at?: string
          hours_on_unit: number
          id?: string
          status_at_submit: Database["public"]["Enums"]["daily_unit_status"]
          timesheet_id: string
          unit_id: string
          unit_note?: string | null
        }
        Update: {
          completed_at_time?: string | null
          created_at?: string
          hours_on_unit?: number
          id?: string
          status_at_submit?: Database["public"]["Enums"]["daily_unit_status"]
          timesheet_id?: string
          unit_id?: string
          unit_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_unit_hours_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_unit_hours_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          contract_id: string
          created_at: string
          crew_count: number | null
          crew_set_id: string | null
          date: string
          drive_evening_end: string | null
          drive_evening_start: string | null
          drive_morning_end: string | null
          drive_morning_start: string | null
          foreman_id: string
          id: string
          lunch_in: string | null
          lunch_out: string | null
          notes: string | null
          photos: string[] | null
          shift_end: string | null
          shift_start: string | null
          status: Database["public"]["Enums"]["timesheet_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          contract_id: string
          created_at?: string
          crew_count?: number | null
          crew_set_id?: string | null
          date: string
          drive_evening_end?: string | null
          drive_evening_start?: string | null
          drive_morning_end?: string | null
          drive_morning_start?: string | null
          foreman_id: string
          id?: string
          lunch_in?: string | null
          lunch_out?: string | null
          notes?: string | null
          photos?: string[] | null
          shift_end?: string | null
          shift_start?: string | null
          status?: Database["public"]["Enums"]["timesheet_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          contract_id?: string
          created_at?: string
          crew_count?: number | null
          crew_set_id?: string | null
          date?: string
          drive_evening_end?: string | null
          drive_evening_start?: string | null
          drive_morning_end?: string | null
          drive_morning_start?: string | null
          foreman_id?: string
          id?: string
          lunch_in?: string | null
          lunch_out?: string | null
          notes?: string | null
          photos?: string[] | null
          shift_end?: string | null
          shift_start?: string | null
          status?: Database["public"]["Enums"]["timesheet_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_crew_set_id_fkey"
            columns: ["crew_set_id"]
            isOneToOne: false
            referencedRelation: "crew_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_foreman_id_fkey"
            columns: ["foreman_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_backlog_overrides: {
        Row: {
          item_id: string
          phase: string | null
          priority: number | null
          size: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          item_id: string
          phase?: string | null
          priority?: number | null
          size?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          item_id?: string
          phase?: string | null
          priority?: number | null
          size?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      tracker_files: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          item_id: string | null
          mime_type: string | null
          note: string | null
          project_id: string
          uploaded_by: string
          uploaded_by_id: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          item_id?: string | null
          mime_type?: string | null
          note?: string | null
          project_id: string
          uploaded_by: string
          uploaded_by_id?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          item_id?: string | null
          mime_type?: string | null
          note?: string | null
          project_id?: string
          uploaded_by?: string
          uploaded_by_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracker_files_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "tracker_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracker_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tracker_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracker_files_uploaded_by_id_fkey"
            columns: ["uploaded_by_id"]
            isOneToOne: false
            referencedRelation: "tracker_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_items: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["tracker_category"]
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["tracker_priority"] | null
          project_id: string
          sort_order: number | null
          status: Database["public"]["Enums"]["tracker_item_status"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          category: Database["public"]["Enums"]["tracker_category"]
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["tracker_priority"] | null
          project_id: string
          sort_order?: number | null
          status?: Database["public"]["Enums"]["tracker_item_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["tracker_category"]
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["tracker_priority"] | null
          project_id?: string
          sort_order?: number | null
          status?: Database["public"]["Enums"]["tracker_item_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracker_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tracker_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_messages: {
        Row: {
          author: string
          author_id: string | null
          content: string
          created_at: string | null
          id: string
          project_id: string
          source: string
          telegram_message_id: number | null
        }
        Insert: {
          author: string
          author_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          project_id: string
          source?: string
          telegram_message_id?: number | null
        }
        Update: {
          author?: string
          author_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          project_id?: string
          source?: string
          telegram_message_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tracker_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "tracker_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracker_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tracker_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_notes: {
        Row: {
          author: string
          content: string
          created_at: string | null
          id: string
          item_id: string
        }
        Insert: {
          author: string
          content: string
          created_at?: string | null
          id?: string
          item_id: string
        }
        Update: {
          author?: string
          content?: string
          created_at?: string | null
          id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_notes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "tracker_items"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_projects: {
        Row: {
          banner_url: string | null
          budget: number | null
          client_name: string | null
          created_at: string | null
          hours_total: number | null
          hours_used: number | null
          id: string
          name: string
          owned_by_email: string | null
          phase: string | null
          scope: string | null
          status: Database["public"]["Enums"]["tracker_project_status"] | null
          updated_at: string | null
        }
        Insert: {
          banner_url?: string | null
          budget?: number | null
          client_name?: string | null
          created_at?: string | null
          hours_total?: number | null
          hours_used?: number | null
          id?: string
          name: string
          owned_by_email?: string | null
          phase?: string | null
          scope?: string | null
          status?: Database["public"]["Enums"]["tracker_project_status"] | null
          updated_at?: string | null
        }
        Update: {
          banner_url?: string | null
          budget?: number | null
          client_name?: string | null
          created_at?: string | null
          hours_total?: number | null
          hours_used?: number | null
          id?: string
          name?: string
          owned_by_email?: string | null
          phase?: string | null
          scope?: string | null
          status?: Database["public"]["Enums"]["tracker_project_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tracker_telegram_config: {
        Row: {
          bot_token: string | null
          chat_id: string | null
          created_at: string | null
          id: string
          notify_on: string[] | null
          project_id: string
        }
        Insert: {
          bot_token?: string | null
          chat_id?: string | null
          created_at?: string | null
          id?: string
          notify_on?: string[] | null
          project_id: string
        }
        Update: {
          bot_token?: string | null
          chat_id?: string | null
          created_at?: string | null
          id?: string
          notify_on?: string[] | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_telegram_config_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "tracker_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_users: {
        Row: {
          auth_id: string | null
          avatar_color: string | null
          created_at: string | null
          display_name: string
          email: string
          id: string
          telegram_chat_id: string | null
          telegram_username: string | null
        }
        Insert: {
          auth_id?: string | null
          avatar_color?: string | null
          created_at?: string | null
          display_name: string
          email: string
          id?: string
          telegram_chat_id?: string | null
          telegram_username?: string | null
        }
        Update: {
          auth_id?: string | null
          avatar_color?: string | null
          created_at?: string | null
          display_name?: string
          email?: string
          id?: string
          telegram_chat_id?: string | null
          telegram_username?: string | null
        }
        Relationships: []
      }
      unit_column_maps: {
        Row: {
          ai_suggested: boolean
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          format_tag: string
          id: string
          is_active: boolean
          landowner: string
          mapping: Json
          parser_mode: string
          updated_at: string | null
          version: number
        }
        Insert: {
          ai_suggested?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          format_tag: string
          id?: string
          is_active?: boolean
          landowner: string
          mapping: Json
          parser_mode: string
          updated_at?: string | null
          version?: number
        }
        Update: {
          ai_suggested?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          format_tag?: string
          id?: string
          is_active?: boolean
          landowner?: string
          mapping?: Json
          parser_mode?: string
          updated_at?: string | null
          version?: number
        }
        Relationships: []
      }
      unit_draws: {
        Row: {
          acres_submitted: number | null
          amount_invoiced: number | null
          amount_paid: number | null
          created_at: string | null
          description: string | null
          draw_number: number
          id: string
          inspection_completed_at: string | null
          inspection_requested_at: string | null
          inspector_name: string | null
          notes: string | null
          payment_received_at: string | null
          status: string
          unit_id: string
          updated_at: string | null
        }
        Insert: {
          acres_submitted?: number | null
          amount_invoiced?: number | null
          amount_paid?: number | null
          created_at?: string | null
          description?: string | null
          draw_number: number
          id?: string
          inspection_completed_at?: string | null
          inspection_requested_at?: string | null
          inspector_name?: string | null
          notes?: string | null
          payment_received_at?: string | null
          status?: string
          unit_id: string
          updated_at?: string | null
        }
        Update: {
          acres_submitted?: number | null
          amount_invoiced?: number | null
          amount_paid?: number | null
          created_at?: string | null
          description?: string | null
          draw_number?: number
          id?: string
          inspection_completed_at?: string | null
          inspection_requested_at?: string | null
          inspector_name?: string | null
          notes?: string | null
          payment_received_at?: string | null
          status?: string
          unit_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unit_draws_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_ingest_audit: {
        Row: {
          action: string
          batch_id: string
          column_map_id: string | null
          created_at: string | null
          field_changes: Json | null
          id: string
          source_file: string | null
          unit_id: string | null
        }
        Insert: {
          action: string
          batch_id: string
          column_map_id?: string | null
          created_at?: string | null
          field_changes?: Json | null
          id?: string
          source_file?: string | null
          unit_id?: string | null
        }
        Update: {
          action?: string
          batch_id?: string
          column_map_id?: string | null
          created_at?: string | null
          field_changes?: Json | null
          id?: string
          source_file?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unit_ingest_audit_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "unit_ingest_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_ingest_audit_column_map_id_fkey"
            columns: ["column_map_id"]
            isOneToOne: false
            referencedRelation: "unit_column_maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_ingest_audit_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_ingest_batches: {
        Row: {
          column_map_id: string | null
          contract_id: string | null
          created_at: string | null
          drive_file_id: string
          drive_file_name: string | null
          drive_parent_folder_id: string | null
          drive_relative_path: string | null
          error_log: Json | null
          finished_at: string | null
          format_tag: string | null
          id: string
          landowner: string | null
          parser_mode: string | null
          rows_created: number | null
          rows_flagged: number | null
          rows_processed: number | null
          rows_skipped: number | null
          rows_updated: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["unit_ingest_batch_status"]
          updated_at: string | null
        }
        Insert: {
          column_map_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          drive_file_id: string
          drive_file_name?: string | null
          drive_parent_folder_id?: string | null
          drive_relative_path?: string | null
          error_log?: Json | null
          finished_at?: string | null
          format_tag?: string | null
          id?: string
          landowner?: string | null
          parser_mode?: string | null
          rows_created?: number | null
          rows_flagged?: number | null
          rows_processed?: number | null
          rows_skipped?: number | null
          rows_updated?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["unit_ingest_batch_status"]
          updated_at?: string | null
        }
        Update: {
          column_map_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          drive_file_id?: string
          drive_file_name?: string | null
          drive_parent_folder_id?: string | null
          drive_relative_path?: string | null
          error_log?: Json | null
          finished_at?: string | null
          format_tag?: string | null
          id?: string
          landowner?: string | null
          parser_mode?: string | null
          rows_created?: number | null
          rows_flagged?: number | null
          rows_processed?: number | null
          rows_skipped?: number | null
          rows_updated?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["unit_ingest_batch_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unit_ingest_batches_column_map_id_fkey"
            columns: ["column_map_id"]
            isOneToOne: false
            referencedRelation: "unit_column_maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_ingest_batches_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_ingest_excludes: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          reason: string | null
          scope_id: string
          scope_type: Database["public"]["Enums"]["unit_ingest_exclude_scope"]
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          reason?: string | null
          scope_id: string
          scope_type: Database["public"]["Enums"]["unit_ingest_exclude_scope"]
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          reason?: string | null
          scope_id?: string
          scope_type?: Database["public"]["Enums"]["unit_ingest_exclude_scope"]
        }
        Relationships: []
      }
      unit_notes: {
        Row: {
          author_id: string | null
          content: string | null
          created_at: string
          id: string
          media_url: string | null
          note_type: Database["public"]["Enums"]["unit_note_type"]
          unit_id: string
        }
        Insert: {
          author_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          media_url?: string | null
          note_type?: Database["public"]["Enums"]["unit_note_type"]
          unit_id: string
        }
        Update: {
          author_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          media_url?: string | null
          note_type?: Database["public"]["Enums"]["unit_note_type"]
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_notes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_pending_review: {
        Row: {
          batch_id: string
          created_at: string | null
          existing_unit_id: string | null
          id: string
          proposed_unit: Json | null
          reason: string
          resolution: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_row: Json | null
          status: Database["public"]["Enums"]["unit_pending_review_status"]
          updated_at: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string | null
          existing_unit_id?: string | null
          id?: string
          proposed_unit?: Json | null
          reason: string
          resolution?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_row?: Json | null
          status?: Database["public"]["Enums"]["unit_pending_review_status"]
          updated_at?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string | null
          existing_unit_id?: string | null
          id?: string
          proposed_unit?: Json | null
          reason?: string
          resolution?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_row?: Json | null
          status?: Database["public"]["Enums"]["unit_pending_review_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unit_pending_review_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "unit_ingest_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_pending_review_existing_unit_id_fkey"
            columns: ["existing_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          amount: number | null
          amount_type: Database["public"]["Enums"]["unit_amount_type"] | null
          avenza_map_url: string | null
          avg_slope_pct: number | null
          best_use: string | null
          completed_at: string | null
          completed_time: string | null
          completion_pct: number | null
          contract_id: string
          county: string | null
          created_at: string
          drive_folder_id: string | null
          elevation_avg: number | null
          elevation_max: number | null
          elevation_min: number | null
          fire_shutdown_zone: number | null
          id: string
          latitude: number | null
          longitude: number | null
          mu_code: string | null
          name: string
          notes: string | null
          pdf_map_path: string | null
          prescription: string | null
          prev_harvest_date: string | null
          price_per_acre: number | null
          price_per_hour: number | null
          price_per_tree: number | null
          price_per_unit: number | null
          seedlings_per_acre: number | null
          site_index: number | null
          species: string[] | null
          stand_key: string | null
          started_at: string | null
          state: string | null
          status: Database["public"]["Enums"]["unit_status"]
          stock_type: string | null
          target_spacing: string | null
          terrain_difficulty:
            | Database["public"]["Enums"]["terrain_difficulty"]
            | null
          total_hours_logged: number | null
          total_seedlings: number | null
          township_range: string | null
          tpa_target: number | null
          updated_at: string
          work_type: string | null
        }
        Insert: {
          amount?: number | null
          amount_type?: Database["public"]["Enums"]["unit_amount_type"] | null
          avenza_map_url?: string | null
          avg_slope_pct?: number | null
          best_use?: string | null
          completed_at?: string | null
          completed_time?: string | null
          completion_pct?: number | null
          contract_id: string
          county?: string | null
          created_at?: string
          drive_folder_id?: string | null
          elevation_avg?: number | null
          elevation_max?: number | null
          elevation_min?: number | null
          fire_shutdown_zone?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          mu_code?: string | null
          name: string
          notes?: string | null
          pdf_map_path?: string | null
          prescription?: string | null
          prev_harvest_date?: string | null
          price_per_acre?: number | null
          price_per_hour?: number | null
          price_per_tree?: number | null
          price_per_unit?: number | null
          seedlings_per_acre?: number | null
          site_index?: number | null
          species?: string[] | null
          stand_key?: string | null
          started_at?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["unit_status"]
          stock_type?: string | null
          target_spacing?: string | null
          terrain_difficulty?:
            | Database["public"]["Enums"]["terrain_difficulty"]
            | null
          total_hours_logged?: number | null
          total_seedlings?: number | null
          township_range?: string | null
          tpa_target?: number | null
          updated_at?: string
          work_type?: string | null
        }
        Update: {
          amount?: number | null
          amount_type?: Database["public"]["Enums"]["unit_amount_type"] | null
          avenza_map_url?: string | null
          avg_slope_pct?: number | null
          best_use?: string | null
          completed_at?: string | null
          completed_time?: string | null
          completion_pct?: number | null
          contract_id?: string
          county?: string | null
          created_at?: string
          drive_folder_id?: string | null
          elevation_avg?: number | null
          elevation_max?: number | null
          elevation_min?: number | null
          fire_shutdown_zone?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          mu_code?: string | null
          name?: string
          notes?: string | null
          pdf_map_path?: string | null
          prescription?: string | null
          prev_harvest_date?: string | null
          price_per_acre?: number | null
          price_per_hour?: number | null
          price_per_tree?: number | null
          price_per_unit?: number | null
          seedlings_per_acre?: number | null
          site_index?: number | null
          species?: string[] | null
          stand_key?: string | null
          started_at?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["unit_status"]
          stock_type?: string | null
          target_spacing?: string | null
          terrain_difficulty?:
            | Database["public"]["Enums"]["terrain_difficulty"]
            | null
          total_hours_logged?: number | null
          total_seedlings?: number | null
          township_range?: string | null
          tpa_target?: number | null
          updated_at?: string
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          company_id: string | null
          created_at: string
          email: string
          id: string
          language_pref: Database["public"]["Enums"]["language_pref"]
          name: string
          permissions: Json | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email: string
          id: string
          language_pref?: Database["public"]["Enums"]["language_pref"]
          name: string
          permissions?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          id?: string
          language_pref?: Database["public"]["Enums"]["language_pref"]
          name?: string
          permissions?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_issues: {
        Row: {
          created_at: string
          description: string
          id: string
          mechanic_eta: string | null
          photos: string[] | null
          priority: Database["public"]["Enums"]["issue_priority"]
          reported_by: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["issue_status"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          mechanic_eta?: string | null
          photos?: string[] | null
          priority?: Database["public"]["Enums"]["issue_priority"]
          reported_by?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          mechanic_eta?: string | null
          photos?: string[] | null
          priority?: Database["public"]["Enums"]["issue_priority"]
          reported_by?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_issues_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_issues_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          assigned_foreman: string | null
          company_id: string
          created_at: string
          id: string
          inspection_date: string | null
          inspection_due: string | null
          insurance_exp: string | null
          license_plate: string | null
          make_model: string | null
          mileage: number | null
          notes: string | null
          status: Database["public"]["Enums"]["vehicle_status"]
          type: Database["public"]["Enums"]["vehicle_type"]
          updated_at: string
          vin: string | null
          year: number | null
        }
        Insert: {
          assigned_foreman?: string | null
          company_id: string
          created_at?: string
          id?: string
          inspection_date?: string | null
          inspection_due?: string | null
          insurance_exp?: string | null
          license_plate?: string | null
          make_model?: string | null
          mileage?: number | null
          notes?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          type: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          assigned_foreman?: string | null
          company_id?: string
          created_at?: string
          id?: string
          inspection_date?: string | null
          inspection_due?: string | null
          insurance_exp?: string | null
          license_plate?: string | null
          make_model?: string | null
          mileage?: number | null
          notes?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          type?: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_assigned_foreman_fkey"
            columns: ["assigned_foreman"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_cache: {
        Row: {
          conditions: string | null
          date: string
          fetched_at: string
          fire_risk_level: number | null
          frost_risk: boolean | null
          humidity: number | null
          id: string
          precipitation: number | null
          snow_risk: boolean | null
          temp_high: number | null
          temp_low: number | null
          unit_id: string | null
          wind_speed: number | null
        }
        Insert: {
          conditions?: string | null
          date: string
          fetched_at?: string
          fire_risk_level?: number | null
          frost_risk?: boolean | null
          humidity?: number | null
          id?: string
          precipitation?: number | null
          snow_risk?: boolean | null
          temp_high?: number | null
          temp_low?: number | null
          unit_id?: string | null
          wind_speed?: number | null
        }
        Update: {
          conditions?: string | null
          date?: string
          fetched_at?: string
          fire_risk_level?: number | null
          frost_risk?: boolean | null
          humidity?: number | null
          id?: string
          precipitation?: number | null
          snow_risk?: boolean | null
          temp_high?: number | null
          temp_low?: number | null
          unit_id?: string | null
          wind_speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weather_cache_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      work_types: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_expense_auto_matches: {
        Row: {
          confidence: number | null
          contract_company_id: string | null
          contract_count: number | null
          contract_id: string | null
          contract_name: string | null
          expense_company_id: string | null
          expense_id: string | null
          import_batch_id: string | null
          method: string | null
          total_hours: number | null
          winning_hours: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["contract_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["expense_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "expense_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      view_project_overview: {
        Row: {
          assigned_foreman: string | null
          completed_units: number | null
          completion_pct: number | null
          end_date: string | null
          in_progress_units: number | null
          landowner: string | null
          location: string | null
          project: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"] | null
          total_units: number | null
          type: Database["public"]["Enums"]["contract_type"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_company_id: { Args: never; Returns: string }
      get_user_employee_id: { Args: never; Returns: string }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin:
        | { Args: never; Returns: boolean }
        | { Args: { check_user_id: string }; Returns: boolean }
    }
    Enums: {
      bid_status: "draft" | "submitted" | "won" | "lost" | "withdrawn"
      company_auth_type: "cascadia" | "ramos" | "both"
      compliance_category:
        | "osha"
        | "flc"
        | "h2b"
        | "training"
        | "insurance"
        | "mileage"
        | "audit"
      compliance_status: "upcoming" | "due_soon" | "overdue" | "completed"
      contract_doc_type:
        | "original_contract"
        | "amendment"
        | "task_order"
        | "supplement"
        | "exhibit"
        | "unit_map"
        | "vicinity_map"
        | "driving_map"
        | "cost_proposal"
        | "bid_form"
        | "spec_sheet"
        | "insurance_cert"
        | "correspondence"
        | "other"
      contract_status:
        | "open"
        | "active"
        | "upcoming"
        | "seasonal"
        | "closed"
        | "archived"
        | "pending_approval"
      contract_type:
        | "private"
        | "dnr_gna"
        | "federal"
        | "weyerhaeuser"
        | "state"
        | "other"
        | "county"
        | "overhead"
      daily_unit_status: "did_not_work" | "in_progress" | "completed"
      employee_doc_type:
        | "passport"
        | "visa"
        | "drivers_license"
        | "drive_authorization"
        | "cpr_cert"
        | "herbicide_license"
        | "fingerprints"
        | "i9"
        | "w4"
        | "onboarding_form"
        | "photo_id"
        | "other"
      employee_status: "active" | "inactive" | "seasonal"
      expense_category:
        | "fuel"
        | "lodging"
        | "equipment"
        | "meals"
        | "vehicle_maintenance"
        | "chainsaw"
        | "safety_gear"
        | "other"
        | "vehicle_rental"
        | "airfare_transit"
        | "tolls_parking"
        | "groceries"
        | "office_admin"
        | "professional_services"
        | "fees_insurance"
      expense_source: "manual" | "credit_card_import"
      incident_severity: "minor" | "moderate" | "severe"
      incident_type: "injury" | "near_miss" | "property_damage" | "vehicle"
      issue_priority: "low" | "medium" | "high" | "critical"
      issue_status: "reported" | "in_progress" | "resolved"
      language_pref: "en" | "es"
      pay_period_status: "open" | "processing" | "exported" | "closed"
      production_type: "tree" | "acre" | "hour"
      rate_type: "hourly" | "daily"
      terrain_difficulty: "easy" | "moderate" | "hard"
      timesheet_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "pending_approval"
      tracker_category:
        | "data_needed"
        | "question"
        | "decision"
        | "task"
        | "bug"
        | "feature"
      tracker_item_status:
        | "pending"
        | "in_progress"
        | "done"
        | "blocked"
        | "future_phase"
      tracker_priority: "blocking" | "high" | "medium" | "low"
      tracker_project_status: "active" | "paused" | "completed"
      unit_amount_type: "tree" | "acre" | "hour"
      unit_ingest_batch_status:
        | "pending"
        | "processing"
        | "success"
        | "partial"
        | "failed"
        | "rolled_back"
      unit_ingest_exclude_scope: "landowner" | "contract" | "unit"
      unit_note_type: "text" | "voice_transcript" | "photo" | "incident"
      unit_pending_review_status:
        | "pending"
        | "approved"
        | "rejected"
        | "resolved"
      unit_status: "not_started" | "in_progress" | "completed" | "pending"
      user_role: "admin" | "office" | "foreman" | "crew"
      vehicle_status: "active" | "in_repair" | "out_of_service"
      vehicle_type: "van" | "pickup" | "box_truck" | "bus"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      bid_status: ["draft", "submitted", "won", "lost", "withdrawn"],
      company_auth_type: ["cascadia", "ramos", "both"],
      compliance_category: [
        "osha",
        "flc",
        "h2b",
        "training",
        "insurance",
        "mileage",
        "audit",
      ],
      compliance_status: ["upcoming", "due_soon", "overdue", "completed"],
      contract_doc_type: [
        "original_contract",
        "amendment",
        "task_order",
        "supplement",
        "exhibit",
        "unit_map",
        "vicinity_map",
        "driving_map",
        "cost_proposal",
        "bid_form",
        "spec_sheet",
        "insurance_cert",
        "correspondence",
        "other",
      ],
      contract_status: [
        "open",
        "active",
        "upcoming",
        "seasonal",
        "closed",
        "archived",
        "pending_approval",
      ],
      contract_type: [
        "private",
        "dnr_gna",
        "federal",
        "weyerhaeuser",
        "state",
        "other",
        "county",
        "overhead",
      ],
      daily_unit_status: ["did_not_work", "in_progress", "completed"],
      employee_doc_type: [
        "passport",
        "visa",
        "drivers_license",
        "drive_authorization",
        "cpr_cert",
        "herbicide_license",
        "fingerprints",
        "i9",
        "w4",
        "onboarding_form",
        "photo_id",
        "other",
      ],
      employee_status: ["active", "inactive", "seasonal"],
      expense_category: [
        "fuel",
        "lodging",
        "equipment",
        "meals",
        "vehicle_maintenance",
        "chainsaw",
        "safety_gear",
        "other",
        "vehicle_rental",
        "airfare_transit",
        "tolls_parking",
        "groceries",
        "office_admin",
        "professional_services",
        "fees_insurance",
      ],
      expense_source: ["manual", "credit_card_import"],
      incident_severity: ["minor", "moderate", "severe"],
      incident_type: ["injury", "near_miss", "property_damage", "vehicle"],
      issue_priority: ["low", "medium", "high", "critical"],
      issue_status: ["reported", "in_progress", "resolved"],
      language_pref: ["en", "es"],
      pay_period_status: ["open", "processing", "exported", "closed"],
      production_type: ["tree", "acre", "hour"],
      rate_type: ["hourly", "daily"],
      terrain_difficulty: ["easy", "moderate", "hard"],
      timesheet_status: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "pending_approval",
      ],
      tracker_category: [
        "data_needed",
        "question",
        "decision",
        "task",
        "bug",
        "feature",
      ],
      tracker_item_status: [
        "pending",
        "in_progress",
        "done",
        "blocked",
        "future_phase",
      ],
      tracker_priority: ["blocking", "high", "medium", "low"],
      tracker_project_status: ["active", "paused", "completed"],
      unit_amount_type: ["tree", "acre", "hour"],
      unit_ingest_batch_status: [
        "pending",
        "processing",
        "success",
        "partial",
        "failed",
        "rolled_back",
      ],
      unit_ingest_exclude_scope: ["landowner", "contract", "unit"],
      unit_note_type: ["text", "voice_transcript", "photo", "incident"],
      unit_pending_review_status: [
        "pending",
        "approved",
        "rejected",
        "resolved",
      ],
      unit_status: ["not_started", "in_progress", "completed", "pending"],
      user_role: ["admin", "office", "foreman", "crew"],
      vehicle_status: ["active", "in_repair", "out_of_service"],
      vehicle_type: ["van", "pickup", "box_truck", "bus"],
    },
  },
} as const
