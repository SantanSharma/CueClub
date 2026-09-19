## Role

Act as a **senior product designer, UX designer, and UI designer** with strong experience designing SaaS dashboards, POS systems, booking systems, inventory management systems, and responsive web/mobile applications.

You have access to the **Figma connector**. Use the Figma connector to actually create the complete UI/UX design and screen layouts in Figma.

Do not just describe the design. **Create the actual Figma design**, including all required screens, components, states, responsive layouts, and interactions/prototypes where appropriate.

---

# Product Overview

I want to build a **Web + Mobile Responsive application for an 8-Ball Pool Club**.

The business currently manages everything using Excel spreadsheets. The goal is to replace that manual process with a simple, modern, easy-to-use management application.

The primary business is **8-ball pool table bookings**, but the club also sells:

* Cold drinks
* Cigarettes
* Snacks
* Food
* Other miscellaneous items

The application should allow the business owner/staff to manage:

* Pool table bookings
* Customers
* Customer bills
* Partial payments
* Product/item sales
* Inventory
* Pricing
* Daily/monthly revenue
* Expenses
* Financial reports
* Excel export

For this MVP, **there is no login/authentication system**.

The prototype should assume that the user is already inside the application.

---

# MVP Technical Assumption

This is currently a prototype/MVP.

All data can be assumed to be stored locally using:

**Browser LocalStorage**

There is no requirement for:

* Backend
* Database
* Authentication
* User management
* Cloud sync
* Payment gateway

The UI should nevertheless be designed in a way that could later be connected to a real backend/database.

---

# Primary UX Goal

The most important requirement is:

> **The application must be extremely easy and fast to operate for a pool club owner or staff member who may not be technically sophisticated.**

The interface should feel:

* Simple
* Fast
* Clear
* Practical
* Modern
* Professional
* Visually attractive
* Easy to learn
* Easy to configure
* Easy to operate during busy hours

Avoid unnecessary complexity.

The user should be able to perform the most common actions within **1–3 clicks/taps whenever reasonably possible**.

Prioritize **operational speed over decorative UI**.

---

# Core Business Scenario

The club currently has **3 pool tables**, but the owner must be able to add more tables from configuration.

For example:

* Table 1
* Table 2
* Table 3

Later:

* Table 4
* Table 5
* etc.

A customer can book a table for a specific date and time.

During or after the booking, the same customer may purchase additional items.

Example:

Customer: John

Pool booking:

* Table 2
* 7:00 PM – 9:00 PM
* 2 hours

Additional purchases:

* 1 × Cold Drink
* 2 × Cigarettes
* 1 × Snack

The system should maintain the customer's running bill.

Example:

Pool booking: ₹400
Cold Drink: ₹50
Cigarettes: ₹40
Snack: ₹80

Total: ₹570

Payment status:

* Unpaid
* Partially Paid
* Paid

Example:

Customer pays ₹300.

The system should show:

Total: ₹570
Paid: ₹300
Remaining: ₹270
Status: Partially Paid

When the customer pays the remaining amount, the bill becomes:

Status: Paid

---

# Required Main Navigation

Create a clear application navigation system.

For desktop, use a sidebar navigation.

For mobile, use an appropriate mobile navigation pattern such as bottom navigation, compact sidebar/drawer, or another UX pattern that makes sense.

Main navigation should include:

1. Dashboard
2. Bookings
3. Customers
4. Sales / Orders
5. Inventory
6. Reports / Finance
7. Configuration / Settings

Also provide a prominent **"New Booking"** action.

---

# 1. DASHBOARD

Create a polished, professional dashboard.

The dashboard should immediately tell the owner what is happening today.

## Dashboard information

Show:

### Today's overview

* Today's revenue
* Today's pool revenue
* Today's product sales
* Today's expenses
* Outstanding/unpaid amount
* Number of bookings
* Number of active bookings
* Number of available tables

### Pool table status

Create a visual table-status section showing:

* Available
* Occupied
* Upcoming booking
* Maintenance/unavailable

For example:

Table 1 — Available
Table 2 — Occupied
Table 3 — Upcoming at 8:00 PM

Make this highly visual and easy to understand.

### Today's bookings

Show a timeline/list/calendar-style view of today's bookings.

Include:

* Customer name
* Table
* Start time
* End time
* Booking amount
* Payment status

### Revenue analytics

Create attractive but understandable charts for:

* Daily revenue
* Weekly revenue
* Monthly revenue
* Pool revenue vs product revenue
* Sales by product/category

### Inventory summary

Show:

* Total inventory items
* Low-stock items
* Out-of-stock items
* Items sold today
* Inventory value if appropriate

### Recent transactions

Show recent:

* Bookings
* Product sales
* Payments

The dashboard should look **classy, premium, clean, and professional**, but should not become visually complicated.

---

# 2. BOOKINGS

Bookings are the most important feature of the application.

Design this area for **very fast booking creation**.

## Booking list

Create a booking management screen with:

* Today / Tomorrow / Date selector
* Calendar/date picker
* Search customer
* Filter by table
* Filter by booking status
* Filter by payment status

Display bookings clearly.

Each booking should show:

* Customer name
* Mobile number
* Table number
* Date
* Start time
* End time
* Duration
* Booking price
* Additional purchases
* Total amount
* Paid amount
* Remaining amount
* Payment status

---

# New Booking Flow

Create a very simple "New Booking" experience.

Required fields:

* Customer name
* Mobile number
* Date
* Pool table
* Start time
* End time
* Duration
* Booking price

Date should default to **today**.

The system should calculate the booking price automatically based on configured hourly pricing.

Example:

Hourly rate = ₹200

2 hours = ₹400

However, the calculated price must be **editable manually** in case the owner wants to override it.

---

# Booking UX

The user should be able to:

* Quickly select a customer
* Create a new customer
* Select a table
* Select date
* Select start/end time
* See availability
* See calculated duration
* See calculated price
* Override price
* Save booking

Prevent obvious booking conflicts.

For example, if Table 2 is already booked from 7 PM–9 PM, the UI should clearly indicate that it is unavailable during that period.

Create appropriate UI states for:

* Available table
* Occupied table
* Upcoming booking
* Booking conflict
* Cancelled booking
* Completed booking

---

# 3. CUSTOMER MANAGEMENT

Create a customer management section.

Each customer should have:

* Name
* Mobile number
* Booking history
* Purchase history
* Total spending
* Outstanding balance
* Payment history

A customer profile should provide a clear view of their complete account.

Example:

## John Doe

Mobile: 9876543210

### Current Bill

Pool Booking: ₹400
Cold Drink × 1: ₹50
Cigarettes × 2: ₹40

Total: ₹490
Paid: ₹300
Remaining: ₹190

Status: Partially Paid

Actions:

* Add Item
* Add Booking
* Add Payment
* Mark as Paid
* View History

---

# 4. SALES / CUSTOMER ORDERS

Customers should also be able to purchase products without booking a pool table.

Example:

A customer walks in and buys:

* 2 drinks
* 1 snack
* 3 cigarette packs

The staff should be able to quickly:

1. Select an existing customer
2. Create a new customer
3. Add items
4. Increase/decrease quantity
5. See total
6. Record payment or leave unpaid

---

# Quantity Controls

Product quantities must have extremely simple controls.

Example:

Cold Drink

[-] 1 [+]

Cigarettes

[-] 2 [+]

Snack

[-] 1 [+]

The user should be able to tap **+ / -** quickly.

---

# Customer Bill

Every customer's account should show:

* Pool bookings
* Products purchased
* Quantity
* Unit price
* Total
* Payments
* Remaining balance
* Payment status

Payment statuses:

* Unpaid
* Partially Paid
* Paid

---

# Partial Payment

This is an important feature.

Create a simple payment interface.

Example:

Total: ₹1,250

Paid: ₹500

Remaining: ₹750

The user can click:

**Add Payment**

Enter:

Amount: ₹300

Then the system displays:

Total: ₹1,250
Previously Paid: ₹500
New Payment: ₹300
Total Paid: ₹800
Remaining: ₹450

Status: Partially Paid

When remaining balance becomes ₹0:

Status: Paid

Create appropriate confirmation/success states.

---

# 5. INVENTORY

Create a complete inventory management interface.

The owner should be able to add inventory items.

Examples:

* Cold Drink
* Cigarettes
* Chips
* Snacks
* Food
* Water
* Other items

Each item should support:

* Item name
* Category
* SKU/code if needed
* Purchase cost
* Selling price
* Current stock
* Minimum stock level
* Unit
* Status
* Created date
* Last updated date

---

# Add Inventory Item

Create a simple form.

Fields:

* Item name
* Category
* Purchase price/cost
* Selling price
* Opening stock
* Minimum stock threshold
* Unit

The user should be able to edit everything later.

---

# Inventory Operations

Support UI for:

* Add stock
* Remove stock
* Adjust stock
* Edit item
* Change selling price
* Change cost
* View stock history

Show clear indicators for:

* In stock
* Low stock
* Out of stock

---

# 6. CONFIGURATION / SETTINGS

Create a highly configurable settings area.

The owner should not need a developer to change business rules.

## Pool configuration

Allow the owner to configure:

* Number of tables
* Table names/numbers
* Hourly booking price
* Different prices if required later
* Opening hours
* Closing hours

For example:

Table 1
Table 2
Table 3

Button:

**+ Add Table**

---

# Pricing Configuration

Allow the owner to configure product pricing.

Example:

Cold Drink
Cost: ₹20
Selling Price: ₹40

Cigarettes
Cost: ₹15
Selling Price: ₹20

Snack
Cost: ₹30
Selling Price: ₹50

Prices should be editable.

---

# Important Pricing UX Rule

Whenever the system automatically calculates something, display the default calculated value.

But allow the staff/user to **manually override the value** when necessary.

For example:

Configured hourly rate:

₹200/hour

Booking:

2 hours

Automatically calculated:

₹400

But the staff can edit:

₹350

The UI should clearly communicate that ₹400 is the default calculated value and ₹350 is a manual override.

Use this principle throughout the application.

---

# 7. REPORTS / FINANCE

Create a financial reporting section.

The owner should be able to understand where money came from.

Reports should include:

### Revenue by date

* Date
* Pool bookings
* Product sales
* Other revenue
* Total revenue

### Product sales

Show:

* Product
* Quantity sold
* Revenue
* Cost
* Gross margin/profit where applicable

### Pool revenue

Show:

* Number of bookings
* Hours booked
* Revenue

### Payments

Show:

* Customer
* Total bill
* Paid
* Remaining
* Payment status
* Payment date

### Expenses

Create an expense tracking interface where the owner can record:

* Expense name
* Category
* Amount
* Date
* Notes

---

# 8. EXCEL EXPORT

One important feature is exporting business data to Excel/CSV.

Create a clear **Export Report** experience.

The user should be able to select:

* Date range
* Today
* This week
* This month
* Custom date range

Then export the financial/business data.

The exported report should conceptually contain information such as:

* Date
* Customer name
* Mobile number
* Pool booking
* Table number
* Booking start time
* Booking end time
* Booking amount
* Products purchased
* Quantity
* Product price
* Product cost
* Total bill
* Paid amount
* Remaining amount
* Payment status
* Expenses
* Revenue category
* Notes

Design an export modal/page that makes this functionality obvious and simple.

---

# 9. RESPONSIVE WEB + MOBILE DESIGN

This must be designed as a **responsive application**, not just a desktop dashboard squeezed onto mobile.

Create appropriate layouts for:

### Desktop

Approximately:

1440px wide

### Tablet

Approximately:

768–1024px

### Mobile

Approximately:

390px wide

The mobile experience should be fully usable.

Prioritize the most common mobile workflows:

* New booking
* View today's bookings
* Add customer
* Add products
* Increase/decrease quantity
* Add payment
* View outstanding balance
* Check table availability

---

# 10. DESIGN SYSTEM

Create a reusable design system in Figma.

Define:

### Colors

Use a professional, premium visual language appropriate for a pool club.

The design can use a sophisticated dark/light combination, but maintain excellent readability and accessibility.

Potential direction:

* Deep charcoal/navy
* Emerald/green or pool-inspired accent
* White/light neutral surfaces
* Clear success/warning/error colors

Do not overuse gradients.

---

# Typography

Use a modern, highly readable font system.

Establish:

* Display
* H1
* H2
* H3
* Body
* Caption
* Label
* Button text

---

# Components

Create reusable Figma components for:

* Buttons
* Inputs
* Search
* Dropdowns
* Date picker
* Time picker
* Tables
* Cards
* Stat cards
* Badges
* Status indicators
* Modals
* Drawers
* Tabs
* Toasts
* Alerts
* Empty states
* Loading states
* Error states
* Quantity controls
* Payment controls
* Booking cards
* Product cards
* Customer cards
* Table status cards
* Charts
* Navigation/sidebar
* Mobile bottom navigation

Use variants where appropriate.

---

# 11. IMPORTANT UI STATES

Do not design only the "happy path."

Create relevant states for:

### Booking

* Empty
* Available
* Booked
* Conflict
* Cancelled
* Completed

### Payment

* Unpaid
* Partially paid
* Fully paid

### Inventory

* In stock
* Low stock
* Out of stock

### Customer

* New customer
* Existing customer
* Customer with outstanding balance
* Customer with no outstanding balance

### Data

* Loading
* Empty
* Error
* Success

---

# 12. MAIN SCREENS TO DESIGN

At minimum, create complete UI layouts for:

1. Dashboard
2. Bookings list
3. Booking calendar/timeline
4. New booking
5. Edit booking
6. Booking details
7. Customers list
8. Customer profile/details
9. Add customer
10. Customer bill
11. Add product/order
12. Product sales/order details
13. Inventory list
14. Add inventory item
15. Edit inventory item
16. Inventory item details/history
17. Payments
18. Add payment
19. Reports dashboard
20. Revenue report
21. Product sales report
22. Expenses
23. Add expense
24. Excel/CSV export
25. Configuration overview
26. Pool/table configuration
27. Pricing configuration
28. Product/category configuration

Also create appropriate confirmation dialogs, empty states, error states, and success states.

---

# 13. QUICK ACTIONS

Because this is an operational application, create a prominent quick-action system.

Possible actions:

* * New Booking
* * Add Customer
* * Add Sale
* * Add Payment
* * Add Inventory
* * Add Expense

On mobile, these should be especially easy to access.

---

# 14. BOOKING WORKFLOW

Design the complete workflow:

### Scenario

Staff opens application.

They see today's dashboard.

Customer arrives.

Staff clicks:

**New Booking**

Then:

1. Select existing customer OR create customer
2. Select table
3. Select date
4. Select start time
5. Select end time
6. System calculates duration
7. System calculates default booking price
8. Staff can override price
9. Save booking

Then the customer purchases:

1. Click Add Item
2. Select Cold Drink
3. Tap + once
4. Select Cigarettes
5. Tap + twice
6. Total updates automatically
7. Customer pays partially
8. Staff records payment
9. Remaining amount is displayed

Design this entire workflow in Figma.

---

# 15. VISUAL DESIGN DIRECTION

The final UI should feel like a **modern premium SaaS/POS application designed specifically for a pool club**.

Visual characteristics:

* Clean
* Premium
* Modern
* Minimal
* High contrast
* Easy to scan
* Spacious but efficient
* Strong hierarchy
* Excellent typography
* Clear CTAs
* Consistent spacing
* Subtle borders/shadows
* Attractive data visualization
* Professional dashboard

Avoid:

* Excessive decoration
* Excessive gradients
* Tiny text
* Complicated forms
* Overloaded dashboards
* Unnecessary animations
* Too many colors
* Generic template-looking UI

The interface should feel purpose-built rather than like a generic admin dashboard.

---

# 16. Figma File Organization

Please organize the Figma file professionally.

Use pages/sections such as:

1. **Cover / Overview**
2. **Design System**
3. **Components**
4. **Desktop Screens**
5. **Tablet Screens**
6. **Mobile Screens**
7. **Prototype / User Flows**

Use consistent naming conventions.

Create reusable components rather than duplicating UI elements.

Use Auto Layout extensively.

Use responsive constraints and appropriate component variants.

---

# 17. Prototype / Interaction Requirements

Where useful, connect the screens into a clickable prototype.

At minimum, demonstrate these flows:

### Flow 1 — Create Booking

Dashboard → New Booking → Select Customer → Select Table → Select Time → Booking Confirmation

### Flow 2 — Add Products

Booking/Customer → Add Item → Select Product → Quantity +/− → Updated Bill

### Flow 3 — Partial Payment

Customer Bill → Add Payment → Enter Amount → Updated Balance → Partial Payment Status

### Flow 4 — Complete Payment

Customer Bill → Add Payment → Remaining Balance = ₹0 → Paid Status

### Flow 5 — Inventory

Inventory → Add Item → Save → Inventory List

### Flow 6 — Configuration

Settings → Pool Configuration → Pricing → Save Changes

### Flow 7 — Reporting

Reports → Select Date Range → View Revenue → Export

---

# 18. UX DETAILS

Think through real-world edge cases.

For example:

* Customer books a table that overlaps an existing booking.
* Customer has multiple bookings.
* Customer has unpaid bills.
* Customer makes multiple partial payments.
* Product goes out of stock.
* Product price changes after previous sales.
* Staff manually overrides a calculated price.
* Owner adds a new pool table.
* Owner changes hourly pool pricing.
* Customer purchases products without booking a table.
* Customer pays more than once.
* Booking is cancelled.
* Booking is completed.
* Inventory is adjusted manually.

Design the UI states necessary to support these scenarios.

---

# 19. Important Product Principle

Do not design this as a complicated enterprise ERP.

This is a **small business operational tool**.

The owner/staff should be able to open the application and immediately understand:

> "What is happening today?"

and quickly perform:

> "Book a table → Add items → Collect payment → Done."

The application should reduce the amount of work currently being done in Excel.

---

# Final Deliverable

Using the **Figma connector**, create the actual complete UI/UX design for this application.

I want:

* Full application layout
* Desktop responsive design
* Tablet responsive design
* Mobile responsive design
* All major screens
* Design system
* Reusable components
* Component variants
* Forms
* Tables
* Cards
* Modals
* Empty states
* Error states
* Success states
* Booking workflows
* Payment workflows
* Inventory workflows
* Configuration screens
* Reports
* Excel export flow
* Clickable prototype for major user journeys

Before creating the UI, first think through the information architecture and user flows.

Then build the Figma design systematically.

**Do not stop at a few sample screens. Build the complete MVP UI system and all major screens required to operate the application.**

The final result should be visually polished enough to serve as the **actual product design specification for development**.
