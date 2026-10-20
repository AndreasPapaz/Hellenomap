
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admins": {
                  Row: {
                    "email": string
                  }
                  ComputedFields: never
                  Insert: {
                    "email": string
                  }
                  Update: {
                    "email"?: string
                  }
                  Relationships: [
                    
                  ]
                },"business_categories": {
                  Row: {
                    "business_id": string,"category_id": number,"is_primary": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"category_id": number,"is_primary"?: boolean
                  }
                  Update: {
                    "business_id"?: string,"category_id"?: number,"is_primary"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_categories_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_categories_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"businesses": {
                  Row: {
                    "address": string,"city": string | null,"country": string,"created_at": string,"description": string | null,"id": string,"location": unknown,"name": string,"needs_location": boolean,"origin": Database["public"]['Enums']["business_origin"],"owner_edited_fields": (string)[],"phone": string | null,"possible_duplicate_of": string | null,"postal_code": string | null,"published": boolean,"region": string | null,"slug": string,"source_url": string | null,"status": Database["public"]['Enums']["business_status"],"updated_at": string,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address": string,"city"?: string | null,"country"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"location"?: unknown,"name": string,"needs_location"?: boolean,"origin": Database["public"]['Enums']["business_origin"],"owner_edited_fields"?: (string)[],"phone"?: string | null,"possible_duplicate_of"?: string | null,"postal_code"?: string | null,"published"?: boolean,"region"?: string | null,"slug": string,"source_url"?: string | null,"status"?: Database["public"]['Enums']["business_status"],"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "address"?: string,"city"?: string | null,"country"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"location"?: unknown,"name"?: string,"needs_location"?: boolean,"origin"?: Database["public"]['Enums']["business_origin"],"owner_edited_fields"?: (string)[],"phone"?: string | null,"possible_duplicate_of"?: string | null,"postal_code"?: string | null,"published"?: boolean,"region"?: string | null,"slug"?: string,"source_url"?: string | null,"status"?: Database["public"]['Enums']["business_status"],"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "businesses_possible_duplicate_of_fkey"
      columns: ["possible_duplicate_of"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "group_id": number,"id": number,"name": string,"slug": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": number,"id"?: never,"name": string,"slug": string,"sort"?: number
                  }
                  Update: {
                    "group_id"?: number,"id"?: never,"name"?: string,"slug"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "category_groups"
      referencedColumns: ["id"]
    }
                  ]
                },"category_groups": {
                  Row: {
                    "id": number,"name": string,"slug": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"name": string,"slug": string,"sort"?: number
                  }
                  Update: {
                    "id"?: never,"name"?: string,"slug"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"moderation_events": {
                  Row: {
                    "action": Database["public"]['Enums']["moderation_action"],"actor": string,"at": string,"business_id": string,"diff": Json | null,"id": number,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": Database["public"]['Enums']["moderation_action"],"actor": string,"at"?: string,"business_id": string,"diff"?: Json | null,"id"?: never,"reason"?: string | null
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["moderation_action"],"actor"?: string,"at"?: string,"business_id"?: string,"diff"?: Json | null,"id"?: never,"reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_events_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"source_category_map": {
                  Row: {
                    "category_id": number,"source_slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": number,"source_slug": string
                  }
                  Update: {
                    "category_id"?: number,"source_slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "source_category_map_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"submission_private": {
                  Row: {
                    "business_id": string,"client_hash": string,"created_at": string,"ownership_note": string | null,"submitter_email": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"client_hash": string,"created_at"?: string,"ownership_note"?: string | null,"submitter_email": string
                  }
                  Update: {
                    "business_id"?: string,"client_hash"?: string,"created_at"?: string,"ownership_note"?: string | null,"submitter_email"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "submission_private_business_id_fkey"
      columns: ["business_id"]
isOneToOne: true
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "businesses_in_view":
{ Args: { "category_slugs"?: (string)[],"group_slugs"?: (string)[],"max_lat": number,"max_lng": number,"max_results"?: number,"min_lat": number,"min_lng": number,"ref_lat": number,"ref_lng": number }; Returns: {
              "address": string,"category_slugs_all": (string)[],"distance_m": number,"group_slug": string,"id": string,"lat": number,"lng": number,"name": string,"phone": string,"primary_category_name": string,"primary_category_slug": string,"slug": string,"website": string
            }[]
                           },
"find_possible_duplicate":
{ Args: { "candidate_name": string,"lat": number,"lng": number }; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"moderate_business":
{ Args: { "p_action": Database["public"]['Enums']["moderation_action"],"p_categories"?: (string)[],"p_fields"?: Json,"p_id": string,"p_lat"?: number,"p_lng"?: number,"p_reason"?: string }; Returns: undefined
                           }
          }
          Enums: {
            "business_origin": "import"|"submission","business_status": "pending"|"approved"|"rejected","moderation_action": "approve"|"reject"|"edit"|"unpublish"|"republish"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "business_origin": ["import", "submission"],"business_status": ["pending", "approved", "rejected"],"moderation_action": ["approve", "reject", "edit", "unpublish", "republish"]
          }
        }
} as const
