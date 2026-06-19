# DOKUMENTASI UTILS & SERVICES

## Daftar Isi
1. [Backend Utils](#backend-utils)
2. [Frontend Utils](#frontend-utils)
3. [Backend Services](#backend-services)
4. [Helper Functions](#helper-functions)

---

## Backend Utils

### 1. `utils/helpers.py`

#### `generate_code(prefix, model, field='code')`
- **Deskripsi**: Generate kode unik dengan auto-increment
- **Parameters**:
  - `prefix` (str) - Prefix kode (e.g., 'WO', 'SO', 'PO')
  - `model` - SQLAlchemy model class
  - `field` (str) - Field name untuk kode (default: 'code')
- **Returns**: String kode unik (e.g., 'WO0001')
- **Example**:
  ```python
  wo_number = generate_code('WO', WorkOrder, 'wo_number')
  # Returns: 'WO0001', 'WO0002', dll
  ```

#### `format_date(date, format='%Y-%m-%d')`
- **Deskripsi**: Format date object ke string
- **Parameters**:
  - `date` - Date/DateTime object
  - `format` (str) - Format string (default: '%Y-%m-%d')
- **Returns**: Formatted date string

#### `parse_date(date_str, format='%Y-%m-%d')`
- **Deskripsi**: Parse string ke date object
- **Parameters**:
  - `date_str` (str) - Date string
  - `format` (str) - Format string
- **Returns**: Date object

#### `sanitize_string(text)`
- **Deskripsi**: Sanitize string untuk mencegah XSS
- **Parameters**: `text` (str) - Input text
- **Returns**: Sanitized string

---

### 2. `utils/calculations.py`

#### `calculate_oee(availability, performance, quality)`
- **Deskripsi**: Calculate Overall Equipment Effectiveness
- **Parameters**:
  - `availability` (float) - Availability rate (0-100)
  - `performance` (float) - Performance rate (0-100)
  - `quality` (float) - Quality rate (0-100)
- **Returns**: OEE score (0-100)
- **Formula**: `OEE = (Availability × Performance × Quality) / 10000`
- **Example**:
  ```python
  oee = calculate_oee(95.0, 80.0, 98.0)
  # Returns: 74.48
  ```

#### `calculate_efficiency(target, actual, downtime_minutes, planned_minutes)`
- **Deskripsi**: Calculate production efficiency dengan downtime limit
- **Parameters**:
  - `target` (float) - Target quantity
  - `actual` (float) - Actual quantity
  - `downtime_minutes` (int) - Total downtime
  - `planned_minutes` (int) - Planned runtime
- **Returns**: Tuple (efficiency_rate, base_efficiency)
- **Logic**:
  ```python
  base_efficiency = (actual / target) * 100
  downtime_percent = (downtime_minutes / planned_minutes) * 100
  
  # Apply business rules (max downtime: 40%)
  allowed_downtime = min(downtime_percent, 40.0)
  efficiency_rate = base_efficiency * (1 - allowed_downtime / 100)
  ```

#### `calculate_downtime_loss(downtime_category, minutes, planned_minutes)`
- **Deskripsi**: Calculate efficiency loss dari downtime dengan limit per kategori
- **Parameters**:
  - `downtime_category` (str) - Category (mesin, operator, material, design, others)
  - `minutes` (int) - Downtime duration
  - `planned_minutes` (int) - Planned runtime
- **Returns**: Loss percentage (with category limit applied)
- **Limits**:
  - mesin: max 15%
  - operator: max 7%
  - material: 0% (tidak boleh ada downtime material)
  - design: max 8%
  - others: max 10%

#### `calculate_quality_rate(good_quantity, total_quantity)`
- **Deskripsi**: Calculate quality rate
- **Parameters**:
  - `good_quantity` (float) - Good products
  - `total_quantity` (float) - Total products
- **Returns**: Quality rate (0-100)
- **Formula**: `(good_quantity / total_quantity) * 100`

---

### 3. `utils/product_calculations.py`

#### `calculate_material_requirements(bom, quantity_kartons)`
- **Deskripsi**: Calculate material requirements dari BOM untuk quantity tertentu
- **Parameters**:
  - `bom` (BillOfMaterials) - BOM object
  - `quantity_kartons` (float) - Target quantity dalam karton
- **Returns**: Dict dengan material requirements
- **Example**:
  ```python
  requirements = calculate_material_requirements(bom, 1000)
  # Returns:
  # {
  #   'rayon': { 'quantity': 150.5, 'uom': 'kg', 'cost': 3750000 },
  #   'polyester': { 'quantity': 75.0, 'uom': 'kg', 'cost': 1500000 }
  # }
  ```

#### `calculate_batch_size(product, target_kartons)`
- **Deskripsi**: Calculate berapa batch diperlukan untuk target kartons
- **Parameters**:
  - `product` (Product) - Product object
  - `target_kartons` (float) - Target quantity
- **Returns**: Dict dengan batch info
- **Formula**:
  ```python
  batch_size = product.ukuran_batch_ctn or 1
  batches_needed = math.ceil(target_kartons / batch_size)
  ```

#### `calculate_fabric_consumption(product, kartons)`
- **Deskripsi**: Calculate konsumsi kain (rayon, polyester, ES)
- **Parameters**:
  - `product` (Product) - Product object dengan % komposisi
  - `kartons` (float) - Quantity kartons
- **Returns**: Dict dengan consumption per material
- **Logic**: Menggunakan `berat_kering`, `meter_kain`, dan % komposisi

---

### 4. `utils/business_rules.py`

#### `validate_downtime_limits(shift_production)`
- **Deskripsi**: Validate apakah downtime melebihi limit per kategori
- **Parameters**: `shift_production` (ShiftProduction) - Shift production object
- **Returns**: Dict dengan validation results
- **Example**:
  ```python
  validation = validate_downtime_limits(shift_production)
  # Returns:
  # {
  #   'valid': False,
  #   'errors': [
  #     { 'category': 'mesin', 'actual': 18.5, 'limit': 15.0 }
  #   ]
  # }
  ```

#### `apply_downtime_limits(downtime_dict, planned_minutes)`
- **Deskripsi**: Apply business rule limits ke downtime
- **Parameters**:
  - `downtime_dict` (dict) - Dict dengan downtime per kategori
  - `planned_minutes` (int) - Planned runtime
- **Returns**: Dict dengan limited downtime

#### `validate_material_availability(bom, quantity)`
- **Deskripsi**: Validate apakah material cukup untuk produksi
- **Parameters**:
  - `bom` (BillOfMaterials) - BOM object
  - `quantity` (float) - Target quantity
- **Returns**: Dict dengan availability status
- **Example**:
  ```python
  availability = validate_material_availability(bom, 1000)
  # Returns:
  # {
  #   'available': False,
  #   'shortages': [
  #     { 'material': 'Rayon', 'required': 150.5, 'available': 100.0, 'shortage': 50.5 }
  #   ]
  # }
  ```

---

### 5. `utils/costing_helper.py`

#### `calculate_production_cost(work_order, actual_materials_used)`
- **Deskripsi**: Calculate total production cost untuk work order
- **Parameters**:
  - `work_order` (WorkOrder) - Work order object
  - `actual_materials_used` (list) - List actual materials used
- **Returns**: Dict dengan cost breakdown
- **Components**:
  - Material cost
  - Labor cost
  - Overhead cost
  - Total cost
  - Cost per unit

#### `allocate_overhead(direct_cost, overhead_rate=0.20)`
- **Deskripsi**: Allocate overhead cost berdasarkan direct cost
- **Parameters**:
  - `direct_cost` (float) - Direct cost (material + labor)
  - `overhead_rate` (float) - Overhead rate (default 20%)
- **Returns**: Overhead cost
- **Formula**: `direct_cost * overhead_rate`

#### `calculate_wip_value(work_order)`
- **Deskripsi**: Calculate Work-in-Progress value
- **Parameters**: `work_order` (WorkOrder) - WO with status in_progress
- **Returns**: WIP value based on % completion

---

### 6. `utils/document_generator.py`

#### `generate_work_order_pdf(work_order_id)`
- **Deskripsi**: Generate PDF untuk Work Order
- **Parameters**: `work_order_id` (int) - Work Order ID
- **Returns**: PDF file path
- **Content**:
  - WO header info
  - Product details
  - BOM items table
  - Instructions

#### `generate_bom_pdf(bom_id)`
- **Deskripsi**: Generate PDF untuk Bill of Materials
- **Parameters**: `bom_id` (int) - BOM ID
- **Returns**: PDF file path

#### `generate_delivery_note(sales_order_id)`
- **Deskripsi**: Generate Surat Jalan
- **Parameters**: `sales_order_id` (int) - Sales Order ID
- **Returns**: PDF file path

#### `generate_packing_list(shipment_id)`
- **Deskripsi**: Generate Packing List
- **Parameters**: `shipment_id` (int) - Shipment ID
- **Returns**: PDF file path

---

### 7. `utils/email_service.py`

#### `send_email(to_email, subject, body, attachments=None)`
- **Deskripsi**: Send email via SMTP
- **Parameters**:
  - `to_email` (str/list) - Recipient email(s)
  - `subject` (str) - Email subject
  - `body` (str) - Email body (HTML)
  - `attachments` (list) - File paths to attach
- **Returns**: Success boolean

#### `send_password_reset_email(user, reset_token)`
- **Deskripsi**: Send password reset email
- **Parameters**:
  - `user` (User) - User object
  - `reset_token` (str) - Reset token
- **Returns**: Success boolean

#### `send_notification_email(users, notification)`
- **Deskripsi**: Send notification email ke multiple users
- **Parameters**:
  - `users` (list) - List of User objects
  - `notification` (Notification) - Notification object
- **Returns**: Success boolean

---

### 8. `utils/shipping_integration.py`

#### `create_shipment(sales_order_id, carrier, tracking_number)`
- **Deskripsi**: Create shipment record
- **Parameters**:
  - `sales_order_id` (int) - Sales Order ID
  - `carrier` (str) - Shipping carrier (JNE, TIKI, dll)
  - `tracking_number` (str) - Tracking number
- **Returns**: Shipment object

#### `track_shipment(tracking_number, carrier)`
- **Deskripsi**: Track shipment status
- **Parameters**:
  - `tracking_number` (str) - Tracking number
  - `carrier` (str) - Carrier
- **Returns**: Dict dengan tracking info

---

### 9. `utils/fifo_helper.py`

#### `apply_fifo_costing(inventory_transactions)`
- **Deskripsi**: Apply FIFO costing method ke inventory transactions
- **Parameters**: `inventory_transactions` (list) - List of transactions
- **Returns**: Dict dengan FIFO cost calculation

#### `get_oldest_stock_batch(inventory_id)`
- **Deskripsi**: Get oldest stock batch untuk FIFO
- **Parameters**: `inventory_id` (int) - Inventory ID
- **Returns**: Stock batch object

---

### 10. `utils/logger.py`

#### `setup_logging(app)`
- **Deskripsi**: Setup logging untuk Flask app
- **Parameters**: `app` (Flask) - Flask app instance
- **Returns**: Tuple (app_logger, access_logger)
- **Files**:
  - `logs/app.log` - Application logs
  - `logs/error.log` - Error logs
  - `logs/access.log` - Access logs

#### `log_request(logger)`
- **Deskripsi**: Middleware untuk log HTTP requests
- **Returns**: Tuple (before_request, after_request) functions

#### `log_exception(logger)`
- **Deskripsi**: Error handler untuk log exceptions
- **Returns**: Error handler function

---

## Frontend Utils

### 1. `utils/apiConfig.ts`

```typescript
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    me: '/auth/me',
    refreshToken: '/auth/refresh',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password'
  },
  products: {
    list: '/products',
    detail: (id: number) => `/products/${id}`,
    create: '/products',
    update: (id: number) => `/products/${id}`,
    delete: (id: number) => `/products/${id}`,
    categories: '/products/categories'
  },
  production: {
    workOrders: '/production/work-orders',
    workOrderDetail: (id: number) => `/production/work-orders/${id}`,
    shiftProduction: '/production/shift-production',
    downtime: '/production/downtime',
    bom: '/production/bom'
  }
  // ... other endpoints
}
```

---

### 2. `utils/formatters.ts`

#### `formatDate(date, format?)`
```typescript
/**
 * Format date ke string
 * @param date - Date object atau string
 * @param format - Format string (default: 'DD MMM YYYY')
 * @returns Formatted date string
 */
export const formatDate = (date: string | Date, format = 'DD MMM YYYY'): string => {
  // Implementation using date-fns or dayjs
}
```

#### `formatNumber(num, decimals?)`
```typescript
/**
 * Format number dengan thousand separator
 * @param num - Number
 * @param decimals - Decimal places (default: 0)
 * @returns Formatted number string (e.g., "1,000")
 */
export const formatNumber = (num: number, decimals = 0): string => {
  return num.toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}
```

#### `formatCurrency(amount)`
```typescript
/**
 * Format currency (IDR)
 * @param amount - Amount number
 * @returns Formatted currency string (e.g., "Rp 1,000,000")
 */
export const formatCurrency = (amount: number): string => {
  return `Rp ${formatNumber(amount, 0)}`
}
```

#### `formatPercentage(value)`
```typescript
/**
 * Format percentage
 * @param value - Value (0-100)
 * @returns Formatted percentage string (e.g., "75.5%")
 */
export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`
}
```

---

### 3. `utils/validators.ts`

#### `validateEmail(email)`
```typescript
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
```

#### `validatePhone(phone)`
```typescript
export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^(\+62|62|0)[0-9]{9,12}$/
  return phoneRegex.test(phone)
}
```

#### `validateRequired(value)`
```typescript
export const validateRequired = (value: any): boolean => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}
```

---

### 4. `utils/exportUtils.ts`

#### `exportToExcel(data, filename, sheetName?)`
```typescript
/**
 * Export data ke Excel file
 * @param data - Array of objects
 * @param filename - Output filename
 * @param sheetName - Sheet name (optional)
 */
export const exportToExcel = (
  data: any[],
  filename: string,
  sheetName = 'Sheet1'
): void => {
  // Implementation using xlsx library
}
```

#### `exportToPDF(data, filename, options?)`
```typescript
/**
 * Export data ke PDF file
 * @param data - Data to export
 * @param filename - Output filename
 * @param options - PDF options
 */
export const exportToPDF = (
  data: any,
  filename: string,
  options?: PDFOptions
): void => {
  // Implementation using jsPDF
}
```

---

### 5. `utils/errorLogger.ts`

#### `logError(error, context?)`
```typescript
/**
 * Log error ke console & Sentry
 * @param error - Error object
 * @param context - Additional context
 */
export const logError = (error: Error, context?: any): void => {
  console.error('Error:', error)
  if (context) console.error('Context:', context)
  
  // Send to Sentry if available
  if (window.Sentry) {
    window.Sentry.captureException(error, { extra: context })
  }
}
```

---

### 6. `utils/currencyUtils.ts`

#### `convertToRupiah(amount)`
#### `parseCurrency(currencyString)`
#### `calculateTax(amount, taxRate)`

---

## Backend Services

### Event Listeners

#### `utils/production_events.py`

**Function**: `register_production_events(app)`
- Register event listeners untuk production-related events
- Events:
  - `shift_production_created` - Update WO quantity
  - `shift_production_updated` - Recalculate OEE
  - `work_order_completed` - Update inventory, create journal entry

#### `utils/quality_events.py`

**Function**: `register_quality_events(app)`
- Register event listeners untuk quality-related events
- Events:
  - `inspection_failed` - Send notification, create defect record
  - `defect_recorded` - Analyze root cause, suggest corrective action

---

## Helper Functions Summary

### Most Used Functions:

1. **generate_code()** - Auto-generate unique codes
2. **calculate_oee()** - OEE calculation
3. **calculate_efficiency()** - Efficiency dengan downtime limits
4. **calculate_material_requirements()** - BOM requirements
5. **validate_material_availability()** - Stock validation
6. **formatCurrency()** - Currency formatting (frontend)
7. **formatDate()** - Date formatting
8. **exportToExcel()** - Excel export

---

