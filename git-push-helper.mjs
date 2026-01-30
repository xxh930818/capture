import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('========== Git 推送帮助 ==========');
    console.log('由于 GitHub 已禁用密码认证，您需要使用以下方式之一：');
    console.log('');
    console.log('方式 1: 使用 Personal Access Token');
    console.log('1. 访问 https://github.com/settings/tokens');
    console.log('2. 点击 "Generate new token (classic)"');
    console.log('3. 勾选 repo 权限，生成 token');
    console.log('4. 使用 token 作为密码推送');
    console.log('');
    console.log('方式 2: 使用 SSH 密钥');
    console.log('git remote set-url origin git@github.com:xxh930818/capture.git');
    console.log('git push -u origin main');
    console.log('');
    console.log('浏览器将打开 GitHub Token 生成页面...');

    await page.goto('https://github.com/settings/tokens');
    await page.waitForTimeout(5000);

    console.log('');
    console.log('请按以下步骤操作：');
    console.log('1. 点击 "Generate new token (classic)"');
    console.log('2. 输入 token 名称，如 "capture-app"');
    console.log('3. 勾选 repo 权限');
    console.log('4. 点击生成');
    console.log('5. 复制生成的 token');
    console.log('');
    console.log('token 生成后，告诉我，我会帮您配置 git 并推送代码');

    console.log('');
    console.log('浏览器将保持打开 120 秒...');
    await page.waitForTimeout(120000);

  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await browser.close();
  }
})();
