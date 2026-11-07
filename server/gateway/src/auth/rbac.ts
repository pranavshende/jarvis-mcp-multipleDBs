import { UserRole, TOOL_PERMISSIONS, ToolPermission } from '../config/permissions.js';
import { UserContext } from '../security/request_context.js';

export class RBACService {
  public static canAccessTool(user: UserContext, toolName: string): { allowed: boolean; reason?: string } {
    const permission: ToolPermission | undefined = TOOL_PERMISSIONS[toolName];
    if (!permission) {
      return { allowed: false, reason: `Tool '${toolName}' is not registered in the Gateway allowlist.` };
    }

    // Check Role
    if (!permission.allowedRoles.includes(user.role)) {
      return {
        allowed: false,
        reason: `Role '${user.role}' is not authorized to execute tool '${toolName}'. Allowed roles: ${permission.allowedRoles.join(', ')}`,
      };
    }

    // Check Scopes (Founder has wildcard '*')
    if (user.allowedScopes.includes('*')) {
      return { allowed: true };
    }

    const hasAllRequiredScopes = permission.requiredScopes.every((reqScope) =>
      user.allowedScopes.includes(reqScope)
    );

    if (!hasAllRequiredScopes) {
      return {
        allowed: false,
        reason: `User is missing required scope(s): ${permission.requiredScopes.filter((s) => !user.allowedScopes.includes(s)).join(', ')}`,
      };
    }

    return { allowed: true };
  }

  public static canAccessAdmin(user: UserContext): boolean {
    return user.role === 'ROLE_FOUNDER' || user.role === 'ROLE_ADMIN' || (user.role as string) === 'FOUNDER';
  }
}
