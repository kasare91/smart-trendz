# Multi-Branch System Implementation

## Overview
Smart Trendz now supports multiple branches with user activity tracking.

## Database Changes

### New Tables
1. **Branch** - Stores branch information (Accra, Koforidua)
2. **ActivityLog** - Tracks all user actions across the system

### Updated Tables
- **User** - Added `branchId` (nullable for admins), `active` status
- **Customer** - Added `branchId`, `createdBy`, `updatedBy`
- **Order** - Added `branchId`, `createdBy`, `updatedBy`
- **Payment** - Added `createdBy`

## User Roles & Permissions

### ADMIN
- Access to **all branches**
- Can create/manage users
- Can view all activity logs
- Full access to all features
- `branchId` is null

### STAFF
- Access to **assigned branch only**
- Can create/edit orders and customers in their branch
- Can record payments
- Cannot manage users
- Must have a `branchId`

### VIEWER
- Read-only access to assigned branch
- Cannot create or modify data
- Can view orders, customers, payments

## Demo Users

```
admin@smarttrendz.com / admin123
- Role: ADMIN
- Access: All branches

accra@smarttrendz.com / staff123
- Role: STAFF
- Branch: Accra

koforidua@smarttrendz.com / staff123
- Role: STAFF
- Branch: Koforidua
```

## Activity Tracking

All actions are logged with:
- User ID and name
- Branch ID
- Action type (CREATE, UPDATE, DELETE)
- Entity type (ORDER, CUSTOMER, PAYMENT, USER)
- Description
- Timestamp
- Optional metadata (JSON)

### Tracked Actions
- Order creation/updates
- Customer creation/updates
- Payment recording
- User management (admin only)

## Next Steps for Full Implementation

### 1. Update NextAuth Configuration
File: `src/app/api/auth/[...nextauth]/route.ts`

Add to JWT callback:
```typescript
jwt: async ({ token, user }) => {
  if (user) {
    token.id = user.id;
    token.role = user.role;
    token.branchId = user.branchId; // NEW
    token.branchName = user.branch?.name; // NEW
  }
  return token;
},
```

### 2. Create User Management API
File: `src/app/api/users/route.ts`

```typescript
// GET /api/users - List users (admin only)
// POST /api/users - Create user (admin only)
// PUT /api/users/[id] - Update user (admin only)
// DELETE /api/users/[id] - Deactivate user (admin only)
```

### 3. Create Branch API
File: `src/app/api/branches/route.ts`

```typescript
// GET /api/branches - List all branches
// POST /api/branches - Create branch (admin only)
```

### 4. Create Activity Log API
File: `src/app/api/activity-logs/route.ts`

```typescript
// GET /api/activity-logs - Get activity logs with filters
// Filters: branchId, userId, entity, action, dateRange
```

### 5. Update Existing APIs

#### Orders API (`src/app/api/orders/route.ts`)
- Add branch filtering for non-admin users
- Track createdBy/updatedBy
- Log activity

#### Customers API (`src/app/api/customers/route.ts`)
- Add branch filtering for non-admin users
- Track createdBy/updatedBy
- Log activity

#### Payments API (`src/app/api/payments/route.ts`)
- Track createdBy
- Log activity

### 6. UI Components Needed

#### Admin Dashboard
- User management table
- Create/edit user form
- Branch statistics
- Activity log viewer

#### Branch Selector (for admins)
- Dropdown to switch between branches
- "All Branches" option

#### Activity Log Viewer
- Filterable table
- User, action, entity filters
- Date range picker
- Export functionality

### 7. Middleware for Branch Access Control
File: `src/middleware.ts`

```typescript
// Check user's branch access
// Redirect if unauthorized
// Allow admins to access all branches
```

## API Usage Examples

### Log Activity
```typescript
import { logActivity } from '@/lib/activity-log';

await logActivity({
  userId: session.user.id,
  userName: session.user.name,
  branchId: order.branchId,
  action: 'CREATE',
  entity: 'ORDER',
  entityId: order.id,
  description: `Created order ${order.orderNumber} for ${customer.fullName}`,
  metadata: {
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
  },
});
```

### Check Branch Access
```typescript
// For non-admin users
if (session.user.role !== 'ADMIN') {
  // Filter by user's branch
  where.branchId = session.user.branchId;
}
```

### Get Activity Logs
```typescript
import { getActivityLogs } from '@/lib/activity-log';

const logs = await getActivityLogs({
  branchId: 'branch-id',
  entity: 'ORDER',
  limit: 50,
});
```

## Database Queries

### Get branch statistics
```typescript
const stats = await prisma.branch.findUnique({
  where: { id: branchId },
  include: {
    _count: {
      select: {
        customers: true,
        orders: true,
        users: true,
      },
    },
  },
});
```

### Get user's activity summary
```typescript
import { getUserActivitySummary } from '@/lib/activity-log';

const summary = await getUserActivitySummary(userId);
// Returns: totalActivities, recentActivities, activityByType
```

## Security Considerations

1. **Admin privileges required for:**
   - Creating/managing users
   - Viewing all branches
   - Accessing activity logs across all branches

2. **Staff users can only:**
   - Access their assigned branch
   - Create orders/customers in their branch
   - View activity logs for their branch

3. **All mutations should:**
   - Verify user has access to the branch
   - Log the activity
   - Track who made the change

## Migration Notes

- Database was reset with new schema
- All existing data was cleared
- Re-run `yarn prisma:seed` to populate demo data

## Testing

1. Login as admin@smarttrendz.com
   - Should see all branches
   - Can create users

2. Login as accra@smarttrendz.com
   - Should only see Accra customers/orders
   - Cannot access Koforidua data

3. Login as koforidua@smarttrendz.com
   - Should only see Koforidua customers/orders
   - Cannot access Accra data
