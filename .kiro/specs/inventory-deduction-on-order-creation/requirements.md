# Requirements Document

## Introduction

This specification defines the requirements for changing the inventory deduction mechanism from delivery-based to order-creation-based, while adding optional third-party delivery tracking capabilities. The system currently deducts inventory when delivery is recorded (quantity_delivered is updated), but needs to deduct inventory immediately when order items are added. Additionally, the system needs to support optional third-party delivery tracking for record-keeping purposes without affecting inventory management.

## Glossary

- **Order_System**: The order management component responsible for creating, updating, and managing orders
- **Inventory_Manager**: The component responsible for tracking and updating inventory quantities
- **Order_Item**: A line item within an order representing a specific product and quantity
- **Processed_Goods**: The inventory table containing available quantities for products
- **Third_Party_Delivery**: Delivery services provided by external companies (not managed internally)
- **Delivery_Record**: Historical record of delivery information for tracking purposes
- **Order_Status**: The current state of an order in its lifecycle
- **Quantity_Available**: The current available inventory quantity in processed_goods table
- **Backward_Compatibility**: Ensuring existing orders continue to function correctly after system changes

## Requirements

### Requirement 1: Immediate Inventory Deduction

**User Story:** As a warehouse manager, I want inventory to be deducted immediately when order items are added, so that available inventory accurately reflects committed stock.

#### Acceptance Criteria

1. WHEN an order item is added to an order, THE Inventory_Manager SHALL deduct the item quantity from processed_goods.quantity_available immediately
2. WHEN an order item quantity is increased, THE Inventory_Manager SHALL deduct the additional quantity from processed_goods.quantity_available
3. WHEN an order item quantity is decreased, THE Inventory_Manager SHALL restore the reduced quantity to processed_goods.quantity_available
4. WHEN an order item is deleted, THE Inventory_Manager SHALL restore the full item quantity to processed_goods.quantity_available
5. WHEN an order is cancelled, THE Inventory_Manager SHALL restore all order item quantities to processed_goods.quantity_available
6. IF processed_goods.quantity_available is insufficient for an order item, THEN THE Order_System SHALL prevent the order item addition and return an error message

### Requirement 2: Remove Delivery-Based Inventory Deduction

**User Story:** As a system administrator, I want to remove the old delivery-based inventory deduction logic, so that the system uses only the new order-based deduction mechanism.

#### Acceptance Criteria

1. THE Order_System SHALL NOT deduct inventory when quantity_delivered is updated
2. THE Order_System SHALL NOT trigger inventory changes based on delivery records
3. WHEN migrating the system, THE Order_System SHALL preserve existing delivery records for historical reference
4. THE Order_System SHALL maintain delivery-related database fields for backward compatibility

### Requirement 3: Optional Third-Party Delivery Tracking

**User Story:** As a sales manager, I want to optionally track third-party delivery information, so that I can maintain records of external delivery services without affecting inventory.

#### Acceptance Criteria

1. THE Order_System SHALL provide a boolean field "third_party_delivery_enabled" on orders
2. WHEN third_party_delivery_enabled is true, THE Order_System SHALL display delivery tracking fields in the user interface
3. WHEN third_party_delivery_enabled is false, THE Order_System SHALL hide delivery tracking fields in the user interface
4. THE Order_System SHALL allow users to record quantity_delivered for tracking purposes
5. THE Order_System SHALL allow users to enter delivery_partner_name as text
6. THE Order_System SHALL allow users to upload delivery documents (delivery slips, proof of delivery photos)
7. THE Order_System SHALL allow users to enter delivery notes
8. THE Order_System SHALL NOT modify inventory based on third-party delivery tracking data

### Requirement 4: Simplified Order Status Flow

**User Story:** As a business user, I want a simplified order status flow that reflects payment completion rather than delivery status, so that order management is clearer and more straightforward.

#### Acceptance Criteria

1. THE Order_System SHALL support order statuses: DRAFT, CONFIRMED, ORDER_COMPLETED
2. THE Order_System SHALL NOT use PARTIALLY_DELIVERED status for new orders
3. THE Order_System SHALL NOT use DELIVERY_COMPLETED status for new orders
4. WHEN an order's payment is complete, THE Order_System SHALL transition the order to ORDER_COMPLETED status
5. THE Order_System SHALL determine order completion based on payment status, not delivery status
6. THE Order_System SHALL preserve existing status values for backward compatibility with historical orders

### Requirement 5: Backward Compatibility

**User Story:** As a system administrator, I want existing orders to continue functioning correctly after the migration, so that historical data remains intact and accessible.

#### Acceptance Criteria

1. WHEN the system is migrated, THE Order_System SHALL NOT modify inventory for existing orders
2. WHEN the system is migrated, THE Order_System SHALL preserve all existing delivery records
3. WHEN the system is migrated, THE Order_System SHALL preserve all existing order statuses
4. THE Order_System SHALL allow viewing of historical delivery data for existing orders
5. THE Order_System SHALL distinguish between orders created before and after the migration
6. WHEN displaying existing orders, THE Order_System SHALL show delivery information if it exists

### Requirement 6: Document Management for Delivery Tracking

**User Story:** As a sales representative, I want to upload and view delivery documents, so that I can maintain proof of delivery and track shipment details.

#### Acceptance Criteria

1. THE Order_System SHALL allow uploading multiple documents per order
2. THE Order_System SHALL support common file formats (PDF, JPG, PNG)
3. WHEN a document is uploaded, THE Order_System SHALL store it securely with the order reference
4. THE Order_System SHALL allow viewing uploaded documents
5. THE Order_System SHALL allow deleting uploaded documents
6. THE Order_System SHALL display document upload timestamps and uploader information

### Requirement 7: Inventory Restoration on Order Modifications

**User Story:** As a warehouse manager, I want inventory to be correctly restored when orders are modified or cancelled, so that available inventory remains accurate.

#### Acceptance Criteria

1. WHEN an order transitions from CONFIRMED to DRAFT, THE Inventory_Manager SHALL restore all order item quantities to processed_goods.quantity_available
2. WHEN an order is deleted, THE Inventory_Manager SHALL restore all order item quantities to processed_goods.quantity_available
3. WHEN order item modifications fail, THE Inventory_Manager SHALL rollback any inventory changes within the same transaction
4. THE Inventory_Manager SHALL prevent negative quantity_available values
5. WHEN inventory restoration occurs, THE Order_System SHALL log the inventory change for audit purposes

### Requirement 8: Data Migration Strategy

**User Story:** As a system administrator, I want a safe migration strategy that handles existing data correctly, so that the transition to the new system is smooth and error-free.

#### Acceptance Criteria

1. THE Order_System SHALL provide a migration script that identifies orders created before the migration
2. THE Order_System SHALL add a migration_flag or created_before_migration field to distinguish old orders
3. THE Order_System SHALL NOT apply new inventory deduction logic to orders created before migration
4. THE Order_System SHALL validate data integrity after migration
5. THE Order_System SHALL provide rollback capability if migration fails
