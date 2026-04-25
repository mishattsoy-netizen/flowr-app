User request: "add profile picture box nex to the name where pfp will be dissplayed"

### 2. Objective Reconstruction
The user requested the addition of a profile picture (PFP) container in the sidebar footer, positioned next to the user's name, to enhance the personalization of the interface.

### 3. Strategic Reasoning
I added a circular `div` with a gradient background and a border to serve as the PFP container. I used `rounded-full` and `bg-gradient-to-br` to ensure it fits the "premium" design language of the app. The container is positioned before the user name and workspace info, and it remains visible even when the sidebar is collapsed (though the name hides), which is a common and intuitive UX pattern.

### 4. Detailed Blueprint
- Locate the footer section in `Sidebar.tsx`.
- Insert a rounded PFP container with placeholder initials ("M").
- Adjust spacing (`gap-2.5`) for a balanced look.
- Update the name's font weight to `font-semibold` for better contrast.
- Log the interaction.

### 5. Operational Trace
- Modified `src/components/layout/Sidebar.tsx`.
- Inserted a 32x32px circular container with a gradient from `var(--bone-15)` to `var(--bone-6)`.
- Verified the layout in the footer `div`.

### 6. Status Assessment
The PFP box is now visible in the footer. It provides a placeholder for future image integration while immediately improving the visual depth of the sidebar.
