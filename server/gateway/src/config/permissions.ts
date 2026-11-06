export type UserRole =
  | 'ROLE_FOUNDER'
  | 'ROLE_ADMIN'
  | 'ROLE_FINANCE'
  | 'ROLE_SALES'
  | 'ROLE_WAREHOUSE'
  | 'ROLE_OPERATIONS'
  | 'ROLE_EMPLOYEE'
  | 'ROLE_USER';

export interface ToolPermission {
  toolName: string;
  allowedRoles: UserRole[];
  requiredScopes: string[];
  requiresConfirmation: boolean;
  classification: 'READ' | 'MUTATION' | 'ADMIN';
}

export const TOOL_PERMISSIONS: Record<string, ToolPermission> = {
  // 1. Business Metrics Tools (Phase 1)
  get_business_metric: {
    toolName: 'get_business_metric',
    allowedRoles: ['ROLE_FOUNDER', 'ROLE_ADMIN', 'ROLE_FINANCE', 'ROLE_SALES', 'ROLE_OPERATIONS'],
    requiredScopes: ['read:metrics'],
    requiresConfirmation: false,
    classification: 'READ',
  },
  get_partner_ar_aging: {
    toolName: 'get_partner_ar_aging',
    allowedRoles: ['ROLE_FOUNDER', 'ROLE_ADMIN', 'ROLE_FINANCE'],
    requiredScopes: ['read:metrics', 'read:finance'],
    requiresConfirmation: false,
    classification: 'READ',
  },
  get_inventory_valuation: {
    toolName: 'get_inventory_valuation',
    allowedRoles: ['ROLE_FOUNDER', 'ROLE_ADMIN', 'ROLE_FINANCE', 'ROLE_OPERATIONS'],
    requiredScopes: ['read:metrics', 'read:inventory'],
    requiresConfirmation: false,
    classification: 'READ',
  },
  get_dock_receiving_summary: {
    toolName: 'get_dock_receiving_summary',
    allowedRoles: ['ROLE_FOUNDER', 'ROLE_ADMIN', 'ROLE_OPERATIONS', 'ROLE_WAREHOUSE'],
    requiredScopes: ['read:metrics', 'read:receiving'],
    requiresConfirmation: false,
    classification: 'READ',
  },

  // 2. Company Knowledge Tools (Phase 3)
  search_company_knowledge: {
    toolName: 'search_company_knowledge',
    allowedRoles: ['ROLE_FOUNDER', 'ROLE_ADMIN', 'ROLE_FINANCE', 'ROLE_SALES', 'ROLE_WAREHOUSE', 'ROLE_OPERATIONS', 'ROLE_EMPLOYEE', 'ROLE_USER'],
    requiredScopes: ['read:knowledge'],
    requiresConfirmation: false,
    classification: 'READ',
  },
  retrieve_company_context: {
    toolName: 'retrieve_company_context',
    allowedRoles: ['ROLE_FOUNDER', 'ROLE_ADMIN', 'ROLE_FINANCE', 'ROLE_SALES', 'ROLE_WAREHOUSE', 'ROLE_OPERATIONS', 'ROLE_EMPLOYEE', 'ROLE_USER'],
    requiredScopes: ['read:knowledge'],
    requiresConfirmation: false,
    classification: 'READ',
  },
  stage_knowledge_candidate: {
    toolName: 'stage_knowledge_candidate',
    allowedRoles: ['ROLE_FOUNDER', 'ROLE_ADMIN', 'ROLE_FINANCE', 'ROLE_SALES', 'ROLE_OPERATIONS', 'ROLE_EMPLOYEE'],
    requiredScopes: ['write:knowledge_candidate'],
    requiresConfirmation: false,
    classification: 'MUTATION',
  },

  // 3. Restricted Action Tools (Phase 2)
  propose_business_action: {
    toolName: 'propose_business_action',
    allowedRoles: ['ROLE_FOUNDER', 'ROLE_ADMIN', 'ROLE_FINANCE', 'ROLE_SALES', 'ROLE_OPERATIONS'],
    requiredScopes: ['propose:actions'],
    requiresConfirmation: true,
    classification: 'MUTATION',
  },
  confirm_business_action: {
    toolName: 'confirm_business_action',
    allowedRoles: ['ROLE_FOUNDER', 'ROLE_ADMIN', 'ROLE_FINANCE', 'ROLE_OPERATIONS'],
    requiredScopes: ['confirm:actions'],
    requiresConfirmation: true,
    classification: 'MUTATION',
  },

  // 4. Alert Engine Tools (Phase 2)
  get_active_alerts: {
    toolName: 'get_active_alerts',
    allowedRoles: ['ROLE_FOUNDER', 'ROLE_ADMIN', 'ROLE_FINANCE', 'ROLE_OPERATIONS', 'ROLE_WAREHOUSE'],
    requiredScopes: ['read:alerts'],
    requiresConfirmation: false,
    classification: 'READ',
  },

  // 5. Admin & Token Management Tools (Phase 4)
  admin_manage_tokens: {
    toolName: 'admin_manage_tokens',
    allowedRoles: ['ROLE_FOUNDER', 'ROLE_ADMIN'],
    requiredScopes: ['admin:tokens'],
    requiresConfirmation: false,
    classification: 'ADMIN',
  },
};
