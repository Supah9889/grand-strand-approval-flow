export const PENDING_EMPLOYEE_INVITE_STATUSES = ['draft', 'sent', 'expired'];

export function isPendingEmployeeInvite(invite) {
  return !!invite && PENDING_EMPLOYEE_INVITE_STATUSES.includes(invite.status);
}

export function buildSoftDeleteEmployeePlan({
  employee,
  invites = [],
  memberships = [],
  now = new Date().toISOString(),
} = {}) {
  if (!employee?.id) {
    return {
      employeeUpdate: null,
      inviteUpdates: [],
      membershipUpdates: [],
      historicalRecordActions: [],
    };
  }

  return {
    employeeUpdate: {
      active: false,
      invite_status: 'revoked',
      invite_token: null,
      invite_token_expires: '',
      deleted_at: now,
    },
    inviteUpdates: invites
      .filter(invite => invite.employee_id === employee.id && isPendingEmployeeInvite(invite))
      .map(invite => ({
        id: invite.id,
        data: {
          status: 'revoked',
          invite_token_hash: '',
          last_revoked_at: now,
        },
      })),
    membershipUpdates: memberships
      .filter(membership => membership.employee_id === employee.id)
      .map(membership => ({
        id: membership.id,
        data: { is_active: false },
      })),
    historicalRecordActions: [],
  };
}
