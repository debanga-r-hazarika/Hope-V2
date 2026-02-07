# Implementation Plan: Inventory Deduction on Order Creation

## Overview

This implementation plan breaks down the feature into discrete coding tasks that build incrementally. The approach prioritizes database changes first, then backend logic, and finally frontend updates. Each task includes validation through code to ensure correctness early.

## Tasks

- [x] 1. Database schema changes and migration setup
  - [x] 1.1 Create migration script to add new fields to orders table
    - Add `third_party_delivery_enabled` boolean field (default false)
    - Add `created_before_migration` boolean field (default false)
    - _Requirements: 3.1, 5.5, 8.2_
  
  - [x] 1.2 Create third_party_deliveries table and related tables
    - Create `third_party_deliveries` table with fields: id, order_id, quantity_delivered, delivery_partner_name, delivery_notes, created_at, created_by, updated_at
    - Create `third_party_delivery_documents` table linking deliveries to documents
    - Add appropriate indexes and RLS policies
    - _Requirements: 3.4, 3.5, 3.6, 3.7, 6.1_
  
  - [x] 1.3 Update order status constraint to support new status values
    - Modify CHECK constraint to include: DRAFT, CONFIRMED, ORDER_COMPLETED, CANCELLED
    - Keep legacy values (Draft, Confirmed, Partially Delivered, Fully Delivered, Cancelled) for backward compatibility
    - _Requirements: 4.1, 4.6_
  
  - [x] 1.4 Create database functions for order modification validation
    - Implement `can_modify_order(order_id)` function to check if order can be modified
    - Implement `log_inventory_change(processed_good_id, quantity_change, operation_type)` function for audit logging
    - _Requirements: 5.5, 7.5, 8.3_

- [ ] 2. Migration script to mark existing orders
  - [ ] 2.1 Write migration script to identify and mark historical orders
    - Set `created_before_migration = true` for all orders created before migration timestamp
    - Validate that all existing orders are marked correctly
    - _Requirements: 5.1, 5.2, 5.3, 8.1_
  
  - [ ]* 2.2 Write validation script to verify migration integrity
    - Check that all historical orders have the flag set
    - Verify delivery records are preserved
    - Verify order statuses are preserved
    - _Requirements: 8.4_

- [x] 3. Disable old inventory deduction triggers
  - [x] 3.1 Disable or remove delivery-based inventory triggers
    - Disable `reduce_inventory_on_delivery_trigger`
    - Disable `update_order_status_on_delivery` trigger
    - Keep `handle_order_cancellation_trigger` for backward compatibility
    - _Requirements: 2.1, 2.2_
  
  - [ ]* 3.2 Write tests to verify old triggers are disabled
    - Test that updating quantity_delivered does not change inventory
    - Test that creating delivery records does not change inventory
    - _Requirements: 2.1, 2.2_

- [ ] 4. Implement inventory management functions
  - [ ] 4.1 Implement `deductInventory` function
    - Check available quantity before deduction
    - Update processed_goods.quantity_available
    - Log inventory change for audit
    - Throw error if insufficient inventory
    - _Requirements: 1.1, 1.6, 7.4, 7.5_
  
  - [ ] 4.2 Implement `restoreInventory` function
    - Update processed_goods.quantity_available
    - Log inventory change for audit
    - _Requirements: 1.4, 1.5, 7.5_
  
  - [ ] 4.3 Implement `adjustInventory` function
    - Calculate difference between old and new quantities
    - Call deductInventory or restoreInventory based on difference
    - _Requirements: 1.2, 1.3_
  
  - [ ]* 4.4 Write property test for immediate inventory deduction
    - **Property 1: Immediate Inventory Deduction on Item Addition**
    - **Validates: Requirements 1.1**
  
  - [ ]* 4.5 Write property test for inventory adjustment on quantity changes
    - **Property 2: Inventory Adjustment on Quantity Changes**
    - **Validates: Requirements 1.2, 1.3**
  
  - [ ]* 4.6 Write property test for complete inventory restoration
    - **Property 3: Complete Inventory Restoration on Item or Order Removal**
    - **Validates: Requirements 1.4, 1.5, 7.2**
  
  - [ ]* 4.7 Write property test for insufficient inventory rejection
    - **Property 4: Insufficient Inventory Rejection**
    - **Validates: Requirements 1.6**
  
  - [ ]* 4.8 Write property test for non-negative inventory invariant
    - **Property 15: Non-Negative Inventory Invariant**
    - **Validates: Requirements 7.4**

- [ ] 5. Update order item management functions
  - [ ] 5.1 Update `addOrderItem` function to deduct inventory immediately
    - Add validation to check if order can be modified (not locked, not historical, not cancelled)
    - Call `deductInventory` before creating order item record
    - Wrap in transaction for rollback on failure
    - Remove reservation creation logic (no longer needed)
    - _Requirements: 1.1, 1.6, 5.5, 8.3_
  
  - [ ] 5.2 Update `updateOrderItem` function to adjust inventory
    - Add validation to check if order can be modified
    - Handle quantity changes by calling `adjustInventory`
    - Handle processed_good_id changes by restoring old and deducting new
    - Wrap in transaction for rollback on failure
    - _Requirements: 1.2, 1.3, 5.5, 7.3, 8.3_
  
  - [ ] 5.3 Update `deleteOrderItem` function to restore inventory
    - Add validation to check if order can be modified
    - Call `restoreInventory` before deleting order item record
    - Wrap in transaction for rollback on failure
    - _Requirements: 1.4, 5.5, 7.3, 8.3_
  
  - [ ]* 5.4 Write unit tests for order item management edge cases
    - Test adding item with zero quantity (should fail)
    - Test adding item to locked order (should fail)
    - Test adding item to historical order (should fail)
    - Test adding item to cancelled order (should fail)
    - _Requirements: 1.1, 5.5, 8.3_
  
  - [ ]* 5.5 Write property test for transaction rollback on failure
    - **Property 14: Transaction Rollback on Failure**
    - **Validates: Requirements 7.3**

- [ ] 6. Update order status management
  - [ ] 6.1 Update `updateOrderStatus` function for new status flow
    - Handle CANCELLED status by restoring inventory for non-historical orders
    - Prevent manual setting of ORDER_COMPLETED status
    - Add validation to reject legacy status values for new orders
    - _Requirements: 1.5, 4.2, 4.3, 4.4, 7.1_
  
  - [ ] 6.2 Implement automatic ORDER_COMPLETED status transition
    - Create trigger or function to check payment status
    - Transition to ORDER_COMPLETED when payment is complete
    - Base completion on payment, not delivery
    - _Requirements: 4.4, 4.5_
  
  - [ ]* 6.3 Write property test for new order status restrictions
    - **Property 9: New Order Status Restrictions**
    - **Validates: Requirements 4.2, 4.3**
  
  - [ ]* 6.4 Write property test for payment-based order completion
    - **Property 10: Payment-Based Order Completion**
    - **Validates: Requirements 4.4, 4.5**
  
  - [ ]* 6.5 Write property test for status transition inventory restoration
    - **Property 13: Status Transition Inventory Restoration**
    - **Validates: Requirements 7.1**

- [ ] 7. Checkpoint - Ensure core inventory logic works correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement third-party delivery tracking backend
  - [ ] 8.1 Create `recordThirdPartyDelivery` function
    - Validate that third_party_delivery_enabled is true
    - Create or update third_party_deliveries record
    - Ensure inventory is NOT affected
    - _Requirements: 3.2, 3.4, 3.5, 3.7, 3.8_
  
  - [ ] 8.2 Create `updateThirdPartyDelivery` function
    - Update existing third_party_deliveries record
    - Validate order has tracking enabled
    - _Requirements: 3.4, 3.5, 3.7_
  
  - [ ] 8.3 Create `uploadDeliveryDocument` function
    - Upload document to storage
    - Link document to third_party_delivery via third_party_delivery_documents table
    - Validate file format (PDF, JPG, PNG)
    - Store upload timestamp and uploader information
    - _Requirements: 3.6, 6.1, 6.2, 6.3, 6.6_
  
  - [ ] 8.4 Create `fetchThirdPartyDelivery` and `fetchDeliveryDocuments` functions
    - Retrieve delivery information for an order
    - Retrieve all documents linked to a delivery
    - _Requirements: 5.4, 5.6, 6.4_
  
  - [ ] 8.5 Create `deleteDeliveryDocument` function
    - Remove document link from third_party_delivery_documents
    - Delete document from storage
    - _Requirements: 6.5_
  
  - [ ]* 8.6 Write property test for third-party delivery data persistence
    - **Property 7: Third-Party Delivery Data Persistence**
    - **Validates: Requirements 3.4, 3.5, 3.7, 3.8**
  
  - [ ]* 8.7 Write property test for document upload and management
    - **Property 8: Document Upload and Management**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**
  
  - [ ]* 8.8 Write unit tests for third-party delivery error cases
    - Test recording delivery without enabled flag (should fail)
    - Test uploading unsupported file format (should fail)
    - _Requirements: 3.2, 6.2_
  
  - [ ]* 8.9 Write property test for delivery operations not affecting inventory
    - **Property 5: Delivery Operations Do Not Affect Inventory**
    - **Validates: Requirements 2.1, 2.2**

- [x] 9. Update TypeScript types and interfaces
  - [x] 9.1 Update Order type to include new fields
    - Add `third_party_delivery_enabled: boolean`
    - Add `created_before_migration: boolean`
    - Update `status` type to include new values
    - _Requirements: 3.1, 4.1, 5.5_
  
  - [x] 9.2 Create ThirdPartyDelivery and related types
    - Create `ThirdPartyDelivery` interface
    - Create `ThirdPartyDeliveryDocument` interface
    - Create `ThirdPartyDeliveryFormData` interface
    - _Requirements: 3.4, 3.5, 3.6, 3.7_

- [ ] 10. Update frontend - OrderDetail component
  - [ ] 10.1 Add third-party delivery tracking toggle
    - Add checkbox to enable/disable third-party delivery tracking
    - Update order record when toggle changes
    - _Requirements: 3.1_
  
  - [ ] 10.2 Create DeliveryTrackingSection component
    - Show/hide based on third_party_delivery_enabled flag
    - Display fields for quantity_delivered, delivery_partner_name, delivery_notes
    - Include document upload functionality
    - Display uploaded documents with timestamps and uploader info
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 6.6_
  
  - [ ] 10.3 Update order status display
    - Show new status values (DRAFT, CONFIRMED, ORDER_COMPLETED)
    - Handle legacy status values for historical orders
    - _Requirements: 4.1, 4.6_
  
  - [ ]* 10.4 Write property test for conditional field rendering
    - **Property 6: Third-Party Delivery Field Conditional Rendering**
    - **Validates: Requirements 3.2, 3.3**

- [ ] 11. Update frontend - Order item management
  - [ ] 11.1 Update OrderItemForm to show real-time inventory impact
    - Display current available quantity
    - Show how much will be deducted when item is added
    - Show warning if insufficient inventory
    - _Requirements: 1.1, 1.6_
  
  - [ ] 11.2 Add validation to prevent modifying historical orders
    - Disable add/edit/delete buttons for orders with created_before_migration = true
    - Show informational message explaining why modification is disabled
    - _Requirements: 5.5, 8.3_
  
  - [ ] 11.3 Update order item edit/delete to show inventory impact
    - Show how inventory will be adjusted when quantity changes
    - Show how inventory will be restored when item is deleted
    - _Requirements: 1.2, 1.3, 1.4_

- [ ] 12. Update API endpoints
  - [ ] 12.1 Update POST /api/orders/:id/items endpoint
    - Call updated `addOrderItem` function with new inventory logic
    - Return appropriate error messages for validation failures
    - _Requirements: 1.1, 1.6_
  
  - [ ] 12.2 Update PUT /api/orders/:id/items/:itemId endpoint
    - Call updated `updateOrderItem` function with inventory adjustment logic
    - Return appropriate error messages for validation failures
    - _Requirements: 1.2, 1.3_
  
  - [ ] 12.3 Update DELETE /api/orders/:id/items/:itemId endpoint
    - Call updated `deleteOrderItem` function with inventory restoration logic
    - Return appropriate error messages for validation failures
    - _Requirements: 1.4_
  
  - [ ] 12.4 Update PUT /api/orders/:id/status endpoint
    - Call updated `updateOrderStatus` function with new status logic
    - Handle inventory restoration on cancellation
    - _Requirements: 1.5, 4.2, 4.3, 4.4_
  
  - [ ] 12.5 Create POST /api/orders/:id/third-party-delivery endpoint
    - Call `recordThirdPartyDelivery` function
    - Return delivery record with all fields
    - _Requirements: 3.4, 3.5, 3.7_
  
  - [ ] 12.6 Create POST /api/orders/:id/third-party-delivery/documents endpoint
    - Call `uploadDeliveryDocument` function
    - Return document information with upload metadata
    - _Requirements: 3.6, 6.1, 6.2, 6.3, 6.6_
  
  - [ ] 12.7 Create GET /api/orders/:id/third-party-delivery endpoint
    - Call `fetchThirdPartyDelivery` function
    - Return delivery information if exists
    - _Requirements: 5.4, 5.6_
  
  - [ ] 12.8 Create DELETE /api/orders/:id/third-party-delivery/documents/:docId endpoint
    - Call `deleteDeliveryDocument` function
    - Return success confirmation
    - _Requirements: 6.5_

- [ ] 13. Checkpoint - Ensure all features work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Write integration tests
  - [ ]* 14.1 Write integration test for complete order lifecycle
    - Create order → add items → modify items → complete payment → verify status
    - Verify inventory is correctly deducted and adjusted throughout
    - _Requirements: 1.1, 1.2, 1.3, 4.4_
  
  - [ ]* 14.2 Write integration test for order cancellation flow
    - Create order → add items → cancel order → verify inventory restored
    - _Requirements: 1.5_
  
  - [ ]* 14.3 Write integration test for third-party delivery workflow
    - Enable tracking → record delivery → upload documents → verify data
    - Verify inventory is not affected
    - _Requirements: 3.2, 3.4, 3.5, 3.6, 3.7, 3.8_
  
  - [ ]* 14.4 Write integration test for migration compatibility
    - Verify historical orders cannot be modified
    - Verify historical orders display correctly
    - Verify new orders use new logic
    - _Requirements: 5.4, 5.5, 5.6, 8.3_
  
  - [ ]* 14.5 Write property test for migration flag prevents new logic
    - **Property 11: Migration Flag Prevents New Logic Application**
    - **Validates: Requirements 5.5, 8.3**
  
  - [ ]* 14.6 Write property test for historical delivery data accessibility
    - **Property 12: Historical Delivery Data Accessibility**
    - **Validates: Requirements 5.4, 5.6**
  
  - [ ]* 14.7 Write property test for inventory change audit logging
    - **Property 16: Inventory Change Audit Logging**
    - **Validates: Requirements 7.5**

- [ ] 15. Final validation and deployment preparation
  - [ ] 15.1 Run all tests (unit, property, integration)
    - Ensure all tests pass
    - Fix any failing tests
    - _Requirements: All_
  
  - [ ] 15.2 Perform manual testing of critical flows
    - Test order creation with inventory deduction
    - Test order modification and cancellation
    - Test third-party delivery tracking
    - Test historical order display
    - _Requirements: All_
  
  - [ ] 15.3 Prepare rollback plan
    - Document steps to rollback migration if needed
    - Test rollback procedure in staging environment
    - _Requirements: 8.5_
  
  - [ ] 15.4 Update documentation
    - Document new order status flow
    - Document third-party delivery tracking feature
    - Document migration process and backward compatibility
    - _Requirements: All_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- The implementation prioritizes database changes first to ensure data integrity
- All inventory operations are wrapped in transactions for atomicity
- Historical orders (created_before_migration = true) are protected from modification
