const fs = require('fs');
const { execSync } = require('child_process');

const files = execSync(
  'grep -rln CustomPullToRefreshScrollView --include="*.tsx" | grep -v node_modules | grep -v CustomPullToRefreshScrollView.tsx',
  { encoding: 'utf8' }
).trim().split('\n');

console.log('Files to process:', files.length);

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // 1. Remove import line for CustomPullToRefreshScrollView
  content = content.replace(/import \{ CustomPullToRefreshScrollView \} from ['"].*CustomPullToRefreshScrollView['"];?\n/g, '');

  // 2. Add RefreshControl and ScrollView to react-native import
  if (content.indexOf('RefreshControl') === -1) {
    content = content.replace(
      /import \{([^}]+)\} from ['"]react-native['"]/,
      (match, imports) => {
        let importList = imports.split(',').map(s => s.trim()).filter(Boolean);
        if (importList.indexOf('RefreshControl') === -1) importList.push('RefreshControl');
        if (importList.indexOf('ScrollView') === -1) importList.push('ScrollView');
        return 'import { ' + importList.join(', ') + ' } from "react-native"';
      }
    );
  } else if (content.indexOf('ScrollView') === -1) {
    content = content.replace(
      /import \{([^}]+)\} from ['"]react-native['"]/,
      (match, imports) => {
        let importList = imports.split(',').map(s => s.trim()).filter(Boolean);
        if (importList.indexOf('ScrollView') === -1) importList.push('ScrollView');
        return 'import { ' + importList.join(', ') + ' } from "react-native"';
      }
    );
  }

  // 3. Replace opening tag: extract refreshing and onRefresh, convert to ScrollView + RefreshControl
  content = content.replace(
    /<CustomPullToRefreshScrollView\s*\n(\s*)refreshing=\{([^}]+)\}\s*\n\s*onRefresh=\{([^}]+)\}/g,
    '<ScrollView\n$1refreshControl={<RefreshControl refreshing={$2} onRefresh={$3} />}'
  );

  // 4. Replace closing tag
  content = content.replace(/<\/CustomPullToRefreshScrollView>/g, '</ScrollView>');

  if (content !== original) {
    fs.writeFileSync(file, content);
    // Check if any CustomPullToRefreshScrollView references remain
    if (content.indexOf('CustomPullToRefreshScrollView') !== -1) {
      console.log('⚠️  PARTIAL:', file, '(still has references)');
    } else {
      console.log('✅', file);
    }
  } else {
    console.log('❌ No changes:', file);
  }
}
