# Requirements Document

## Introduction

This document specifies the requirements for the Third-Party Delivery Tracking feature in the orders system. The feature enables users to optionally track delivery information when orders are fulfilled through third-party delivery partners, rather than through the company's own delivery system.

The feature is designed for record-keeping purposes only and does not affect inventory management. Inventory is deducted when order items are added, regardless of whether third-party delivery tracking is enabled.

## Glossary

- **Order_System**: The sales order management system that tracks customer orders, items, and payments
- **Third_Party_Delivery**: A delivery service provided by an external partner (e.g., Blue Dart, DTDC, FedEx)
- **Delivery_Record**: A database record containing information about a third-party delivery for a specific order
- **Delivery_Document**: A file (PDF, image) uploaded as evidence of delivery (e.g., delivery slip, proof of delivery)
- **User**: A person with access to the order system (with either read-only or read-write permissions)
- **Order_Detail_Page**: The page displaying comprehensive information about a specific order

## Requirements

### Requirement 1: Enable Third-Party Delivery Tracking

**User Story:** As a user with write access, I want to enable third-party delivery tracking for an order, so that I can record delivery information when using external delivery partners.

#### Acceptance Criteria

1. WHEN a user with read-write access views a non-cancelled order, THE Order_Detail_Page SHALL display a checkbox to enable third-party delivery tracking
2. WHEN the user toggles the checkbox to enabled, THE Order_System SHALL create a delivery record for that order
3. WHEN the user toggles the checkbox to disabled, THE Order_System SHALL remove the delivery record and all associated documents
4. WHEN a user with read-only access views an order, THE Order_System SHALL display the checkbox in a disabled state
5. WHEN an order is cancelled, THE Order_System SHALL not display the third-party delivery tracking section

### Requirement 2: Record Delivery Information

**User Story:** As a user with write access, I want to record delivery details, so that I can maintain accurate records of third-party deliveries.

#### Acceptance Criteria

1. WHEN third-party delivery tracking is enabled, THE Order_Detail_Page SHALL display input fields for quantity delivered, delivery partner name, and delivery notes
2. WHEN the user enters a quantity delivered, THE Order_System SHALL accept numeric values with up to 2 decimal places
3. WHEN the user enters a delivery partner name, THE Order_System SHALL accept text values up to 255 characters
4. WHEN the user enters delivery notes, THE Order_System SHALL accept text values up to 1000 characters
5. WHEN the user saves delivery information, THE Order_System SHALL persist the data to the delivery record
6. WHEN delivery information is saved, THE Order_System SHALL update the timestamp for when the record was last modified

### Requirement 3: Edit Delivery Information

**User Story:** As a user with write access, I want to edit previously recorded delivery information, so that I can correct mistakes or update details.

#### Acceptance Criteria

1. WHEN a delivery record exists, THE Order_Detail_Page SHALL display the saved information in the input fields
2. WHEN the user clicks "Edit Info", THE Order_System SHALL enable the input fields for editing
3. WHEN the user modifies values and clicks "Save", THE Order_System SHALL update the delivery record with the new values
4. WHEN the user clicks "Cancel" during editing, THE Order_System SHALL restore the original values and disable editing mode
5. WHEN a user with read-only access views a delivery record, THE Order_System SHALL display the information in read-only mode

### Requirement 4: Upload Delivery Documents

**User Story:** As a user with write access, I want to upload delivery documents, so that I can maintain evidence of delivery (delivery slips, photos, proof of delivery).

#### Acceptance Criteria

1. WHEN a delivery record exists, THE Order_Detail_Page SHALL display an "Upload Document" button
2. WHEN the user clicks "Upload Document", THE Order_System SHALL open a file selection dialog
3. WHEN the user selects a file, THE Order_System SHALL accept PDF, JPG, JPEG, and PNG file formats
4. WHEN a valid file is selected, THE Order_System SHALL upload the file and create a document record
5. WHEN the upload is complete, THE Order_System SHALL display the document in the documents list with filename and upload timestamp
6. WHEN the upload fails, THE Order_System SHALL display an error message and allow the user to retry
7. WHEN no delivery record exists, THE Order_System SHALL prevent document uploads until delivery information is saved

### Requirement 5: Manage Delivery Documents

**User Story:** As a user with write access, I want to view and delete delivery documents, so that I can manage the evidence associated with each delivery.

#### Acceptance Criteria

1. WHEN delivery documents exist, THE Order_Detail_Page SHALL display each document with its filename and upload timestamp
2. WHEN the user clicks on a document, THE Order_System SHALL open the document in a new browser tab or download it
3. WHEN the user clicks the delete button on a document, THE Order_System SHALL prompt for confirmation
4. WHEN the user confirms deletion, THE Order_System SHALL remove the document record and delete the file from storage
5. WHEN no documents exist, THE Order_Detail_Page SHALL display a message indicating no documents have been uploaded

### Requirement 6: Access Control

**User Story:** As a system administrator, I want to enforce access control on delivery tracking, so that only authorized users can view and modify delivery information.

#### Acceptance Criteria

1. WHEN a user with read-only access views an order, THE Order_System SHALL display delivery information in read-only mode
2. WHEN a user with read-write access views an order, THE Order_System SHALL allow full editing of delivery information
3. WHEN an order is locked (completed and past the edit window), THE Order_System SHALL prevent all modifications to delivery information
4. WHEN a user without sales module access attempts to view delivery information, THE Order_System SHALL deny access
5. WHEN an admin user views an order, THE Order_System SHALL allow full access to delivery information regardless of module access

### Requirement 7: Data Persistence and Integrity

**User Story:** As a system architect, I want delivery data to be properly persisted and maintained, so that records remain accurate and consistent.

#### Acceptance Criteria

1. WHEN a delivery record is created, THE Order_System SHALL store it in the third_party_deliveries table with a unique identifier
2. WHEN delivery documents are uploaded, THE Order_System SHALL store them in the third_party_delivery_documents table linked to the delivery record
3. WHEN an order is deleted, THE Order_System SHALL cascade delete all associated delivery records and documents
4. WHEN a delivery record is deleted, THE Order_System SHALL cascade delete all associated documents
5. THE Order_System SHALL maintain created_at and updated_at timestamps for all delivery records
6. THE Order_System SHALL record the user ID who created or modified delivery records

### Requirement 8: User Interface Integration

**User Story:** As a user, I want the delivery tracking interface to be seamlessly integrated into the order detail page, so that I can easily access and manage delivery information.

#### Acceptance Criteria

1. WHEN viewing an order detail page, THE Order_Detail_Page SHALL display the third-party delivery section below the order items
2. WHEN third-party delivery is disabled, THE Order_Detail_Page SHALL show only the enable checkbox and description
3. WHEN third-party delivery is enabled, THE Order_Detail_Page SHALL expand to show all delivery fields and document management
4. THE Order_Detail_Page SHALL display a visual indicator (icon and title) to clearly identify the delivery tracking section
5. THE Order_Detail_Page SHALL display a notice explaining that delivery tracking is for record-keeping only and does not affect inventory

### Requirement 9: Inventory Independence

**User Story:** As a system architect, I want delivery tracking to be independent of inventory management, so that inventory is deducted at order creation regardless of delivery method.

#### Acceptance Criteria

1. WHEN an order item is added, THE Order_System SHALL deduct inventory immediately
2. WHEN third-party delivery tracking is enabled, THE Order_System SHALL not modify inventory
3. WHEN delivery information is recorded, THE Order_System SHALL not modify inventory
4. WHEN delivery documents are uploaded, THE Order_System SHALL not modify inventory
5. THE Order_System SHALL display a clear notice that delivery tracking does not affect inventory
