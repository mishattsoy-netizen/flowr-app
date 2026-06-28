export type PatchType = 'added' | 'fixed' | 'changed' | 'improved';

export interface PatchSection {
  type: PatchType;
  items: string[];
}

export interface Patch {
  version: string;
  build: string;
  date: string;
  title: string;
  sections: PatchSection[];
  images?: {
    before: string;
    after: string;
    beforeTitle?: string;
    afterTitle?: string;
  };
}

export const PATCHES: Patch[] = [
  {
    version: '1.0.2',
    build: '1002',
    date: '2026-06-28',
    title: 'Desktop App Beta Release',
    sections: [
      {
        type: 'added',
        items: [
          'Added Vault Setup Modal blocking startup on first launch until a local vault directory is selected.',
          'Added directory picker in Account Settings to allow seamlessly switching the local vault folders.',
          'Added desktop Auto-Updater support using github-updater integration.',
          'Added download desktop app action to trigger direct installation setup downloads from the sidebar.'
        ]
      },
      {
        type: 'improved',
        items: [
          'Optimized Electron packaging configuration rules to bundle all required production node_modules.',
          'Exposed updater ipc listeners and actions safely through preload context bridge APIs.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'Fixed missing postbuild file copying script causing Vercel deployment crash.',
          'Fixed type definitions and client-side mappers to support the cloud syncMode enum migration.'
        ]
      }
    ]
  }
];
