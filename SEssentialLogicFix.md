Task: Comprehensive Refactor of Academic Year, Term, Fees, Promotions, Graduation, and Global Filtering System

Review the entire codebase and refactor the architecture related to Classes, Academic Years, Terms, Fees, Student Enrollment, Promotions, Attendance, and Filtering across the application.

The current system stores fee amounts and academic year information during class creation, which causes incorrect fee calculations, term activation issues, and promotion errors. Additionally, filtering across modules such as attendance is inconsistent and leads to a confusing user interface.

The goal is to redesign the system so that Academic Year and Term define the time context of the system, fees are managed per class per term, attendance filtering works reliably, and student promotion and graduation are handled correctly.

All database changes must be implemented through migrations since the database schema is managed through a migrations folder connected to Supabase.

1. Refactor Class Structure

Classes should only represent the structural identity of a class such as the class name and level.

Classes must not store fee amounts, academic year information, or any time-based data.

If the current class structure stores fee amounts or academic year information, remove that logic and create migrations to safely remove or relocate those fields.

2. Academic Year and Term Structure

Ensure the system has a clear structure separating Academic Years and Terms.

An Academic Year represents the overall school year.

Terms represent subdivisions of an academic year.

Only one academic year should be active at a time and only one term should be active at a time.

3. Fee Management Per Class Per Term

Refactor the system so that fees are no longer defined when creating classes.

Instead, fees must be defined for each class for a specific academic year and term.

When a term is created or activated, the admin should be able to define the fee amount for each class for that term.

4. Student Enrollment Tracking

Ensure the system tracks which class a student belongs to during a specific academic year and term rather than assuming a student permanently belongs to one class.

When a student is promoted or assigned to a new class, the system must create a new enrollment record reflecting the student's class during that academic year and term.

The system must not overwrite historical class assignments.

5. Fee Calculation Logic

Refactor all fee calculation logic so that student fees are determined using the student's enrollment during a specific academic year and term and the fee assigned to that class for that same term.

The system must not calculate fees directly from class information.

If a student changes class during a later term, they must only be charged the fee from the term they entered that class onward.

6. Carry Forward Logic

Implement proper carry-forward behavior for unpaid balances.

If a student has unpaid balance at the end of a term, the balance should carry forward to the next term.

If a student has unpaid balance at the end of an academic year, that balance should carry forward to the next academic year and be added to the student's first term fee in the new academic year.

Unpaid balances must follow the student rather than the class.

7. Promotion System

Refactor the promotion logic so that promotions happen when a new academic year begins.

When the admin triggers the "Promote Students" action, the system should move students to the next class based on their class level.

Students should receive a new enrollment record for the new academic year and class.

Promotion must not retroactively assign fees from previous terms of the new class.

8. Final Class Graduation Handling

The highest class level (for example JHS level 3) must not attempt to promote students further.

When students in the final class are processed during promotion, they should be marked as having completed or graduated from the school rather than being promoted to another class.

Graduated students must remain in the system with their full history including attendance, payments, and records.

Graduated students should no longer appear in active class lists, attendance screens, or new fee calculations.

9. Global Filtering System

Refactor the filtering logic across the entire application so that Academic Year, Term, and optionally Date act as the primary filtering context.

These filters must be consistently applied across modules such as:

Student attendance
Teacher attendance
Fees
Payments
Reports
SMS logs
Student records

The system should avoid inconsistent filtering behavior where certain UI actions only appear after selecting multiple unrelated filters.

10. Attendance Module Refactor

Review the student attendance and teacher attendance modules and simplify the marking process.

The UI should allow teachers or admins to mark attendance easily without requiring complicated filter combinations.

The typical flow should be:

Select Academic Year (this can be pulled from the default)
Select Term  (this can be pulled from the default)  
Select Class (Teacher see their class only. but admins must choose )
Select Date  (this can be pulled from the default)  

Once these are selected, the system should immediately display the list of students or teachers for that class and allow attendance marking.

The attendance marking interface should always be visible once the required context is selected.

Attendance should be tied to the selected academic year, term, class, and date so that records remain properly organized and filterable.

11. Filtering UI Improvements

Improve the filtering interface across the application so that users can easily select the academic year and term context before interacting with data.

The system should avoid situations where important actions such as marking attendance only appear after multiple manual filter adjustments.

Filtering should be predictable and consistent across modules.

12. Database Migration Rules

All database changes must be handled through migrations.

If existing tables contain fields that conflict with the new structure, create new migrations to safely modify or remove those fields.

Do not directly modify the database outside of migrations.

13. Codebase Audit

Search the entire codebase for areas where:

Fees are derived directly from class definitions
Students are assumed to belong to a single permanent class
Filtering logic does not include academic year and term context
Attendance logic relies on confusing filter conditions

Refactor those areas so the system consistently follows the new architecture based on academic year, term, enrollment history, and class-term fee assignments.
