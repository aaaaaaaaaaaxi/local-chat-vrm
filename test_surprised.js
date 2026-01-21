// 测试 surprised 情感的简单脚本
console.log("Testing surprised emotion support...");

// 检查 messages.ts 中的修改是否正确
const fs = require('fs');
const path = './src/features/messages/messages.ts';

const content = fs.readFileSync(path, 'utf8');

// 检查是否包含 surprised
const hasSurprisedInEmotions = content.includes('surprised') &&
                               content.includes('const emotions = ["neutral", "happy", "angry", "sad", "relaxed", "surprised"]');
const hasSurprisedInEmotionToTalkStyle = content.includes('case "surprised":\n      return "surprised";');

console.log("✓ surprised 在 emotions 数组中:", hasSurprisedInEmotions);
console.log("✓ surprised 在 emotionToTalkStyle 函数中:", hasSurprisedInEmotionToTalkStyle);

// 检查 koeiromap talk styles
const hasKoeiromapSurprised = content.includes('"surprised"') &&
                             content.includes('const _koeiromapTalkStyles = ["talk", "happy", "sad", "angry", "fear", "surprised"]');

console.log("✓ surprised 在 koeiromap talk styles 中:", hasKoeiromapSurprised);

if (hasSurprisedInEmotions && hasSurprisedInEmotionToTalkStyle && hasKoeiromapSurprised) {
    console.log("🎉 所有修改都已完成！surprised 情应该可以正常工作了。");
    console.log("\n使用方法：");
    console.log("在 AI 对话中添加 [surprised] 标签，例如：");
    console.log("[surprised] 真的吗？太惊讶了！");
} else {
    console.log("❌ 还有修改需要完成。");
}