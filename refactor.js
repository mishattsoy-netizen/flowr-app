const fs = require('fs');
let code = fs.readFileSync('src/components/layout/HeaderBar.tsx', 'utf8');

const mapStart = '{openTabIds.map((tabId, idx) => {';
const mapEnd = '        })}\n\n        {/* + New Tab';

let preMap = code.substring(0, code.indexOf(mapStart));
let postMap = code.substring(code.indexOf(mapEnd) + '        })}\n'.length);

let mapBody = code.substring(code.indexOf(mapStart) + mapStart.length, code.indexOf(mapEnd));

let renderTabFn = '  const renderTab = (tabId: string, idx: number, forceActive?: boolean) => {' + mapBody.replace('const isActive = activeTabId === tabId;', 'const isActive = forceActive !== undefined ? forceActive : activeTabId === tabId;');

let newTabStrip = `
        {splitViewActive && splitViewLeftId && splitViewRightId ? (
          <div className="flex w-full h-full relative items-end">
            <div className="absolute left-0 bottom-0 flex items-end" style={{ width: \`calc(\${splitViewPosition}% - 14px)\` }}>
              {renderTab(splitViewLeftId, 0, true)}
            </div>
            <div className="absolute bottom-0 flex items-end" style={{ left: \`calc(\${splitViewPosition}% + 14px)\`, width: \`calc(\${100 - splitViewPosition}% - 14px)\` }}>
              {renderTab(splitViewRightId, 1, true)}
            </div>
          </div>
        ) : (
          openTabIds.map((tabId, idx) => renderTab(tabId, idx))
        )}
`;

let newCode = preMap.replace('const isDesktopEnv = isDesktop();', 'const isDesktopEnv = isDesktop();\n\n' + renderTabFn) + newTabStrip + postMap;

fs.writeFileSync('src/components/layout/HeaderBar.tsx', newCode);
