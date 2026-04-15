# Project Summary: Dikki Community App

## 1. Project Overview
The **Dikki Community App** is a premium, full-stack mobile platform designed to bridge the gap between citizens and local authorities. It provides a streamlined, transparent, and intelligent environment for reporting, tracking, and resolving community issues such as infrastructure damage, public safety concerns, and utility failures.

## 2. Key Objectives
- **Efficiency**: Reduce the time between issue reporting and resolution.
- **Accessibility**: Provide inclusive reporting tools, including voice-to-text and AI-assisted refinement.
- **Transparency**: Allow users to track the status of their reports in real-time.
- **Accountability**: Distribute responsibilities across clearly defined roles (Authorities, Heads, SuperAdmins).

## 3. Core Features
- **Intelligent Reporting**: Users can report issues via text or voice. Voice reports are processed using AI to generate concise summaries and titles.
- **Multi-Role Dashboards**:
    - **Citizen (User)**: Report issues, join channels, track status, and participate in community feeds.
    - **Authority**: Manage assigned issues, update statuses, and communicate with reporters.
    - **Head (Organization/Channel Lead)**: Oversee specific community channels, manage members, and assign issues to authorities.
    - **SuperAdmin**: Full system control, including user management, channel oversight, and global analytics.
- **Community Channels**: Issues are organized into "Channels" (e.g., specific neighborhoods or organizations), allowing localized management.
- **Advanced Analytics**: Real-time tracking of resolution rates, average resolution time, and issue distribution by category.
- **Modern Design**: A high-end UI/UX featuring a "Community Purple" and "Join Green" palette, Satoshi/General Sans typography, and full dark/light mode support.

## 4. Technical Architecture
### Frontend (Mobile)
- **Framework**: React Native (Expo)
- **Navigation**: React Navigation (Stacks)
- **Storage**: @react-native-async-storage/async-storage for local persistence.
- **UI**: Custom premium design system built with vanilla CSS-in-JS.

### Backend (Server)
- **Environment**: Node.js with Express.
- **Database**: SQLite (local persistence via `data.sqlite`).
- **Authentication**: JWT (JSON Web Tokens) for secure session management.
- **File Management**: Local filesystem storage for uploaded images and voice records.

## 5. System Workflow
1. **Creation**: A user selects a channel and submits a report (with optional image/audio).
2. **Assignment**: The report appears in the Channel's feed. The Channel Head or SuperAdmin can assign it to a specific Authority based on the category.
3. **Resolution**: The Authority investigates the issue, updates the status (e.g., In Progress, Resolved), and adds comments.
4. **Verification**: The user is notified of the resolution and can view the updated status in their feed.

## 6. Target Audience
- Local government bodies seeking digital transformation.
- Housing societies and NGO groups.
- General public looking for a reliable way to reach authorities.

---
*This document serves as the foundation for the project synopsis and formal report drafting.*
