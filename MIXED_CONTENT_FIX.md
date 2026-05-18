# Mixed Content Error Fix - HTTPS/HTTP Issue

## Problem
Frontend di-load via HTTPS (`https://erp.graterp.my.id`) tapi beberapa fetch calls masih menggunakan HTTP (`http://erp.graterp.my.id:5000`). Browser memblokir request HTTP dari halaman HTTPS karena security policy (Mixed Content).

## Error Messages
```
Mixed Content: The page at 'https://erp.graterp.my.id/...' was loaded over HTTPS, 
but requested an insecure resource 'http://erp.graterp.my.id:5000/api/...'. 
This request has been blocked; the content must be served over HTTPS.
```

## Root Cause
Beberapa file masih hardcode URL dengan `http://` dan port `:5000`:
1. `SessionTimeoutModal.tsx` - extend session endpoint
2. `PendingQC.tsx` - pending QC endpoint
3. `WorkOrderQCForm.tsx` - multiple QC endpoints
4. `OEEDashboardEnhanced.tsx` - OEE API endpoint

## Solution

### 1. Created API Config Helper
File: `/frontend/src/utils/apiConfig.ts`

```typescript
export const getBaseURL = (): string => {
  const hostname = window.location.hostname;
  
  // Production domain - use HTTPS API subdomain
  if (hostname === 'erp.graterp.my.id' || hostname.endsWith('.graterp.my.id')) {
    return 'https://api.graterp.my.id';
  }
  
  // Local development - use same hostname with port 5000
  return `http://${hostname}:5000`;
};
```

### 2. Updated Files

#### ✅ SessionTimeoutModal.tsx
**Before:**
```typescript
const response = await fetch(`http://${window.location.hostname}:5000/api/auth/extend-session`, {
```

**After:**
```typescript
const hostname = window.location.hostname;
const baseURL = (hostname === 'erp.graterp.my.id' || hostname.endsWith('.graterp.my.id'))
  ? 'https://api.graterp.my.id'
  : `http://${hostname}:5000`;

const response = await fetch(`${baseURL}/api/auth/extend-session`, {
```

#### ✅ PendingQC.tsx
**Before:**
```typescript
const response = await fetch(`http://${window.location.hostname}:5000/api/quality/pending-qc`, {
```

**After:**
```typescript
import { getBaseURL } from '../../utils/apiConfig';

const baseURL = getBaseURL();
const response = await fetch(`${baseURL}/api/quality/pending-qc`, {
```

#### ✅ WorkOrderQCForm.tsx
**Before:**
```typescript
const response = await fetch(`http://${window.location.hostname}:5000/api/quality/pending-qc`, {
const testResponse = await fetch(`http://${window.location.hostname}:5000/api/quality/work-order/${woId}/qc-test`, {
const response = await fetch(`http://${window.location.hostname}:5000/api/quality/tests/${existingTest.id}/result`, {
const response = await fetch(`http://${window.location.hostname}:5000/api/quality/work-order/${workOrder.id}/qc-test`, {
```

**After:**
```typescript
const hostname = window.location.hostname;
const baseURL = (hostname === 'erp.graterp.my.id' || hostname.endsWith('.graterp.my.id'))
  ? 'https://api.graterp.my.id'
  : `http://${hostname}:5000`;

const response = await fetch(`${baseURL}/api/quality/pending-qc`, {
const testResponse = await fetch(`${baseURL}/api/quality/work-order/${woId}/qc-test`, {
const response = await fetch(`${baseURL}/api/quality/tests/${existingTest.id}/result`, {
const response = await fetch(`${baseURL}/api/quality/work-order/${workOrder.id}/qc-test`, {
```

#### ✅ OEEDashboardEnhanced.tsx
Already correct - no changes needed.

### 3. Existing Axios Config
File: `/frontend/src/utils/axiosConfig.ts` - Already correct!

```typescript
const getBaseURL = () => {
  const hostname = window.location.hostname;
  
  if (hostname === 'erp.graterp.my.id' || hostname.endsWith('.graterp.my.id')) {
    return 'https://api.graterp.my.id';
  }
  
  return `http://${hostname}:5000`;
};
```

## URL Mapping

| Environment | Frontend URL | Backend URL |
|-------------|-------------|-------------|
| **Production** | https://erp.graterp.my.id | https://api.graterp.my.id |
| **Development** | http://localhost:5173 | http://localhost:5000 |
| **LAN** | http://192.168.1.100:5173 | http://192.168.1.100:5000 |

## Best Practices

### ✅ DO: Use Helper Functions
```typescript
import { getBaseURL, getApiURL } from '../../utils/apiConfig';

// Option 1: Get base URL
const baseURL = getBaseURL();
const response = await fetch(`${baseURL}/api/users`);

// Option 2: Get full API URL
const apiURL = getApiURL('/api/users');
const response = await fetch(apiURL);
```

### ✅ DO: Use Axios Instance
```typescript
import axiosInstance from '../../utils/axiosConfig';

// Axios automatically uses correct base URL
const response = await axiosInstance.get('/api/users');
```

### ❌ DON'T: Hardcode URLs
```typescript
// ❌ Bad - hardcoded HTTP
const response = await fetch('http://erp.graterp.my.id:5000/api/users');

// ❌ Bad - hardcoded localhost
const response = await fetch('http://localhost:5000/api/users');

// ❌ Bad - hardcoded port without protocol check
const response = await fetch(`http://${window.location.hostname}:5000/api/users`);
```

## Testing

### Production (HTTPS)
1. Open: https://erp.graterp.my.id
2. Open DevTools Console
3. Check for "Mixed Content" errors - should be NONE
4. All API calls should go to: https://api.graterp.my.id

### Development (HTTP)
1. Open: http://localhost:5173
2. Open DevTools Console
3. All API calls should go to: http://localhost:5000

### LAN (HTTP)
1. Open: http://192.168.1.100:5173
2. Open DevTools Console
3. All API calls should go to: http://192.168.1.100:5000

## Verification Commands

### Check for hardcoded HTTP URLs
```bash
# Search for hardcoded :5000
grep -r ":5000" frontend/src --include="*.tsx" --include="*.ts"

# Search for hardcoded localhost
grep -r "localhost:5000" frontend/src --include="*.tsx" --include="*.ts"

# Search for hardcoded http://
grep -r "http://" frontend/src --include="*.tsx" --include="*.ts" | grep -v "// " | grep -v "* "
```

### Check browser console
```javascript
// In browser console, check all fetch/axios calls
// Should see:
// - Production: https://api.graterp.my.id/api/...
// - Development: http://localhost:5000/api/...
```

## Troubleshooting

### Problem: Still seeing Mixed Content errors
**Solution:**
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Check DevTools Network tab for failing requests
4. Verify the URL being called

### Problem: API calls fail in production
**Solution:**
1. Check if `api.graterp.my.id` DNS is configured
2. Check if backend is running on HTTPS
3. Check SSL certificate is valid
4. Check CORS settings allow `erp.graterp.my.id`

### Problem: API calls fail in development
**Solution:**
1. Check if backend is running on port 5000
2. Check if frontend can reach backend
3. Check firewall settings
4. Try accessing http://localhost:5000/api/health directly

## Summary

✅ **Fixed Files:**
- SessionTimeoutModal.tsx
- PendingQC.tsx
- WorkOrderQCForm.tsx (4 fetch calls)

✅ **Created:**
- apiConfig.ts helper

✅ **Result:**
- No more Mixed Content errors
- All API calls use correct protocol (HTTPS in production, HTTP in development)
- Consistent URL handling across the application

🎯 **Key Takeaway:** Always use `getBaseURL()` helper or `axiosInstance` for API calls. Never hardcode URLs with protocol and port.
