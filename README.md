Last login: Wed Sep 24 17:40:41 on ttys000
sidechaine@MacBook-Pro-Nikita ~ % cd /Users/sidechaine/Documents/beLive || { echo "папка не найдена"; exit 1; }
sidechaine@MacBook-Pro-Nikita beLive % gh auth status || { echo "gh не авторизован"; exit 1; }
github.com
  ✓ Logged in to github.com account side-chaine (keyring)
  - Active account: true
  - Git operations protocol: ssh
  - Token: gho_************************************
  - Token scopes: 'admin:public_key', 'delete_repo', 'gist', 'read:org', 'repo'
sidechaine@MacBook-Pro-Nikita beLive % gh api -X DELETE /repos/side-chaine/beLive/branches/main/protection || true

{
  "message": "Branch not protected",
  "documentation_url": "https://docs.github.com/rest/branches/branch-protection#delete-branch-protection",
  "status": "404"
}
gh: Branch not protected (HTTP 404)
sidechaine@MacBook-Pro-Nikita beLive % gh repo view side-chaine/beLive --json name >/dev/null 2>&1 \
  && { echo "Удаляю remote repo side-chaine/beLive ..."; gh repo delete side-chaine/beLive --confirm; } \
  || echo "Remote repo не найден или уже удалён, продолжаю."

Удаляю remote repo side-chaine/beLive ...
Flag --confirm has been deprecated, use `--yes` instead
✓ Deleted repository side-chaine/beLive
sidechaine@MacBook-Pro-Nikita beLive % git worktree list 2>/dev/null | awk 'NR>1 {print $1}' | xargs -r -I{} git worktree remove {} || true
rm -rf .git

sidechaine@MacBook-Pro-Nikita beLive % rm -rf private-assets
sidechaine@MacBook-Pro-Nikita beLive % git init
hint: Using 'master' as the name for the initial branch. This default branch name
hint: is subject to change. To configure the initial branch name to use in all
hint: of your new repositories, which will suppress this warning, call:
hint:
hint: 	git config --global init.defaultBranch <name>
hint:
hint: Names commonly chosen instead of 'master' are 'main', 'trunk' and
hint: 'development'. The just-created branch can be renamed via this command:
hint:
hint: 	git branch -m <name>
hint:
hint: Disable this message with "git config set advice.defaultBranchName false"
Инициализирован пустой репозиторий Git в /Users/sidechaine/Documents/beLive/.git/
sidechaine@MacBook-Pro-Nikita beLive % git config user.name "Nikita Side-Chaine"
git config user.email "nikitosss007@gmail.com"
git add -A
git commit -m "chore: initial clean commit" -s

[master (корневой коммит) 5859341] chore: initial clean commit
 252 files changed, 128528 insertions(+)
 create mode 100644  .cursor/rules/optimization-roadmap.mdc
 create mode 100644 .eslintignore
 create mode 100644 .eslintrc.json
 create mode 100644 .github/CODEOWNERS
 create mode 100644 .github/ISSUE_TEMPLATE/bug_report.md
 create mode 100644 .github/ISSUE_TEMPLATE/feature_request.md
 create mode 100644 .github/ISSUE_TEMPLATE/issue_template.md
 create mode 100644 .github/ISSUE_TEMPLATE/research.md
 create mode 100644 .github/PULL_REQUEST_TEMPLATE.md
 create mode 100644 .github/PULL_REQUEST_TEMPLATE/pull_request_template.md
 create mode 100644 .github/dependabot.yml
 create mode 100644 .github/workflows.disabled/dco-placeholder.yml.disabled
 create mode 100644 .github/workflows.disabled/dco.yml.disabled
 create mode 100644 .github/workflows/dco-placeholder.yml
 create mode 100644 .github/workflows/deploy-pages.yml
 create mode 100644 .github/workflows/deploy.yml
 create mode 100644 .gitignore
 create mode 100644 BUG_FIX_ROADMAP.md
 create mode 100644 Concert/pexels-apasaric-2078071.jpg
 create mode 100644 Concert/pexels-jackgittoes-761543.jpg
 create mode 100644 Concert/pexels-mark-angelo-sampan-738078-1587927.jpg
 create mode 100644 Concert/pexels-markusspiske-92078.jpg
 create mode 100644 Concert/pexels-picjumbo-com-55570-196652.jpg
 create mode 100644 Concert/pexels-rahulp9800-1652353.jpg
 create mode 100644 Concert/pexels-teddy-2263436.jpg
 create mode 100644 Concert/pexels-thibault-trillet-44912-167491.jpg
 create mode 100644 Concert/pexels-wendywei-1190297.jpg
 create mode 100644 Concert/pexels-wendywei-1677710.jpg
 create mode 100644 Docs/EXPORT_POC.md
 create mode 100644 Docs/PITCH_GUIDE.md
 create mode 100644 Docs/QUICK_START.md
 create mode 100644 IMPLEMENTATION_PLAN.md
 create mode 100644 INVENTORY.md
 create mode 100644 Karaoke/boliviainteligente-NFY0BeronrE-unsplash.jpg
 create mode 100644 Karaoke/bruno-cervera-Gi6-m_t_W-E-unsplash.jpg
 create mode 100644 Karaoke/kane-reinholdtsen-LETdkk7wHQk-unsplash.jpg
 create mode 100644 Karaoke/pexels-amit-batra-3062797-4658541.jpg
 create mode 100644 Karaoke/pexels-capturexpression-26530062.jpg
 create mode 100644 Karaoke/pexels-clemlep-13659549.jpg
 create mode 100644 Karaoke/pexels-isabella-mendes-107313-332688.jpg
 create mode 100644 Karaoke/pexels-katriengrevendonck-2101487.jpg
 create mode 100644 Karaoke/pexels-marcin-dampc-807808-1684187.jpg
 create mode 100644 Karaoke/pexels-maumascaro-1154189.jpg
 create mode 100644 Karaoke/pexels-mccutcheon-1191710.jpg
 create mode 100644 Karaoke/pexels-pixabay-164879.jpg
 create mode 100644 Karaoke/pexels-pixabay-164960.jpg
 create mode 100644 Karaoke/pexels-suvan-chowdhury-37305-144429.jpg
 create mode 100644 Karaoke/pexels-trinitykubassek-341858.jpg
 create mode 100644 Karaoke/prince-abid-LeZItQhwFks-unsplash.jpg
 create mode 100644 Karaoke/yichen-wang-aBeTfQ65ycQ-unsplash.jpg
 create mode 100644 LICENSE
 create mode 100644 PROJECT_OVERVIEW_FOR_AI_COUNCIL.md
 create mode 100644 README.md
 create mode 100644 ROADMAP.md
 create mode 100644 Rehearsal/.gitkeep
 create mode 100644 Rehearsal/4b8023db-3000-4084-bef9-b7aec2a804da.jpg
 create mode 100644 Rehearsal/README.txt
 create mode 100644 Rehearsal/didzhej_muzyka_diskoteka_160929_2560x1440.jpg
 create mode 100644 Rehearsal/dj_naushniki_ustanovka_122020_2560x1440.jpg
 create mode 100644 Rehearsal/dvoichnyj_kod_kod_tsifry_147523_2560x1440.jpg
 create mode 100644 Rehearsal/fotoapparat_obektiv_remeshok_145518_1600x900.jpg
 create mode 100644 Rehearsal/gitara_bas_gitara_struny_106722_2560x1440.jpg
 create mode 100644 Rehearsal/krolik_naushniki_muzyka_130283_2560x1440.jpg
 create mode 100644 Rehearsal/muzykalnyj_instrument_muzyka_udarnye_106370_2560x1440.jpg
 create mode 100644 Rehearsal/naushniki_knigi_obrazovanie_121501_2560x1600.jpg
 create mode 100644 Rehearsal/naushniki_ustanovka_muzyka_104587_1280x1024.jpg
 create mode 100644 Rehearsal/noty_griaznyj_bumaga_124163_2560x1440.jpg
 create mode 100644 Rehearsal/pexels-antonh-145707.jpg
 create mode 100644 Rehearsal/pexels-bclarkphoto-1135995.jpg
 create mode 100644 Rehearsal/pexels-conojeghuo-375893.jpg
 create mode 100644 Rehearsal/pexels-david-bartus-43782-844928.jpg
 create mode 100644 Rehearsal/pexels-didsss-1653090.jpg
 create mode 100644 Rehearsal/pexels-everson-mayer-478307-1481309.jpg
 create mode 100644 Rehearsal/pexels-joshsorenson-995301.jpg
 create mode 100644 Rehearsal/pexels-nikita-khandelwal-178978-632656.jpg
 create mode 100644 Rehearsal/pexels-pixabay-159376.jpg
 create mode 100644 Rehearsal/pexels-pixabay-159613.jpg
 create mode 100644 Rehearsal/pexels-pixabay-164716.jpg
 create mode 100644 Rehearsal/pexels-pixabay-164769.jpg
 create mode 100644 Rehearsal/pexels-pixabay-164853.jpg
 create mode 100644 Rehearsal/pexels-pixabay-164938.jpg
 create mode 100644 Rehearsal/pexels-pixabay-210766.jpg
 create mode 100644 Rehearsal/pexels-pixabay-257904.jpg
 create mode 100644 Rehearsal/pexels-pixabay-270288.jpg
 create mode 100644 Rehearsal/pexels-pixabay-290660.jpg
 create mode 100644 Rehearsal/pexels-reneterp-1327430.jpg
 create mode 100644 Rehearsal/soty_obem_zheleznyj_167098_2560x1440.jpg
 create mode 100644 Rehearsal/vinilovaia_plastinka_tonarm_kartridzh_107810_2560x1440.jpg
 create mode 100644 SECURITY.md
 create mode 100644 assets/fonts/oswald-bold.ttf
 create mode 100644 assets/fonts/oswald-regular.ttf
 create mode 100644 code_of_conduct.md
 create mode 100644 continue.config.example.yaml
 create mode 100644 contributing.md
 create mode 100644 css/avatar-page.css
 create mode 100644 css/block_editor.css
 create mode 100644 css/bmp-styles.css
 create mode 100644 css/catalog-v2.css
 create mode 100644 css/catalog.css
 create mode 100644 css/concert-styles.css
 create mode 100644 css/conveyor-styles.css
 create mode 100644 css/font-selector.css
 create mode 100644 css/fonts.css
 create mode 100644 css/home-button-enhanced.css
 create mode 100644 css/karaoke-styles.css
 create mode 100644 css/live-mode.css
 create mode 100644 css/loop-button-styles.css
 create mode 100644 css/main.css
 create mode 100644 css/mode-buttons-override.css
 create mode 100644 css/rehearsal-styles.css
 create mode 100644 css/style.css
 create mode 100644 css/styles.css
 create mode 100644 css/styles.css.backup
 create mode 100644 css/styles.css.bak
 create mode 100644 css/styles.css.bak2
 create mode 100644 css/transport-controls.css
 create mode 100644 css/waveform-source-switcher.css
 create mode 100644 dco-test-2.txt
 create mode 100644 dco-test.txt
 create mode 100644 eslint.config.cjs
 create mode 100644 eslint.config.mjs
 create mode 100644 img/masks/blue.png
 create mode 100644 img/masks/blur.png
 create mode 100644 img/masks/concert.png
 create mode 100644 img/masks/gradient.png
 create mode 100644 img/masks/grayscale.png
 create mode 100644 img/masks/green.png
 create mode 100644 img/masks/matrix.png
 create mode 100644 img/masks/nature.png
 create mode 100644 img/masks/neon.png
 create mode 100644 img/masks/none.png
 create mode 100644 img/masks/party.png
 create mode 100644 img/masks/placeholder.png
 create mode 100644 img/masks/sepia.png
 create mode 100644 img/masks/stars.png
 create mode 100644 img/masks/studio.png
 create mode 100644 img/masks/sunset.png
 create mode 100644 img/masks/vintage.png
 create mode 100644 index.html
 create mode 100644 inventory.json
 create mode 100644 js/.!33560!mask-system.js
 create mode 100644 js/app.js
 create mode 100644 js/audio-engine.js
 create mode 100644 js/audio-engine/README.md
 create mode 100644 js/audio-source-adapter.js
 create mode 100644 js/auto-integrator.js
 create mode 100644 js/background-effects-engine.js
 create mode 100644 js/block-loop-control.js
 create mode 100644 js/block_editor.js
 create mode 100644 js/catalog-v2.js
 create mode 100644 js/catalog.js
 create mode 100644 js/color-service.js
 create mode 100644 js/concert-background.js
 create mode 100644 js/constants.js
 create mode 100644 js/creative-masks.js
 create mode 100644 js/debug-config.js
 create mode 100644 js/dev-flags.js
 create mode 100644 js/drag-boundary-controller.js
 create mode 100644 js/enhanced-rtf-processor.js
 create mode 100644 js/enhanced-text-editor-fixed.js
 create mode 100644 js/enhanced-text-processor.js
 create mode 100644 js/karaoke-background.js
 create mode 100644 js/lib/audio-context.js
 create mode 100644 js/lib/audio-engine.js
 create mode 100644 js/lib/face-mesh.js
 create mode 100644 js/lib/live-masks.js
 create mode 100644 js/lib/utils.js
 create mode 100644 js/lib/video-processor.js
 create mode 100644 js/live-feed.js
 create mode 100644 js/live-mode.js
 create mode 100644 js/logger.js
 create mode 100644 js/loopblock-manager.js
 create mode 100644 js/lyrics-display.js
 create mode 100644 js/lyrics-display.js.bak
 create mode 100644 js/lyrics-display.js.bak2
 create mode 100644 js/lyrics-display.js.migration-backup
 create mode 100644 js/main.js
 create mode 100644 js/marker-manager.js
 create mode 100644 js/mask-system.js
 create mode 100644 js/modal-block-editor.js
 create mode 100644 js/piano-keyboard-backup.js
 create mode 100644 js/piano-keyboard-backup2.js
 create mode 100644 js/piano-keyboard-backup3.js
 create mode 100644 js/piano-keyboard-backup4.js
 create mode 100644 js/piano-keyboard-fix.js
 create mode 100644 js/piano-keyboard-fixed.js
 create mode 100644 js/piano-keyboard-improvements.js
 create mode 100644 js/piano-keyboard-integration-plan.md
 create mode 100644 js/piano-keyboard-lookahead.js
 create mode 100644 js/piano-keyboard-manual-fix.js
 create mode 100644 js/piano-keyboard-nav-fix.js
 create mode 100644 js/piano-keyboard-patch.js
 create mode 100644 js/piano-keyboard.js
 create mode 100644 js/piano-keyboard.js.bak
 create mode 100644 js/rehearsal-background.js
 create mode 100644 js/rtf-parser-adapter.js
 create mode 100644 js/rtf-parser-integration.js
 create mode 100644 js/rtf-parser.js
 create mode 100644 js/rtf-parser.js.backup
 create mode 100644 js/rtf-simple-parser.js
 create mode 100644 js/state-manager.js
 create mode 100644 js/text-processor-integrator.js
 create mode 100644 js/text-processor.js
 create mode 100644 js/text-style-manager.js
 create mode 100644 js/track-catalog.js
 create mode 100644 js/utils.js
 create mode 100644 js/vendor/face-landmarks-detection.min.js
 create mode 100644 js/vendor/tf-backend-webgl.min.js
 create mode 100644 js/vendor/tf-core.min.js
 create mode 100644 js/vendor/three.min.js
 create mode 100644 js/view-manager.js
 create mode 100644 js/waveform-editor.js
 create mode 100644 package-lock.json
 create mode 100644 package.json
 create mode 100644 resources/masks/confetti.svg
 create mode 100644 resources/masks/glasses1.svg
 create mode 100644 resources/masks/glasses2.svg
 create mode 100644 resources/masks/hat1.svg
 create mode 100644 resources/masks/mustache.svg
 create mode 100644 resources/masks/rainbow.svg
 create mode 100644 rtf-parser.js
 create mode 100644 test/avatar-carrier-curator.html
 create mode 100644 test/avatar-page-cockpit-pro.html
 create mode 100644 test/avatar-page-final.html
 create mode 100644 test/avatar-page-gemini.html
 create mode 100644 test/avatar-page-modern.html
 create mode 100644 test/block-editor-undo.html
 create mode 100644 test/catalog-design-test.html
 create mode 100644 test/concept1-live-feed.html
 create mode 100644 test/live-avatar-poc.html
 create mode 100644 test/live-masks-demo.html
 create mode 100644 test/live-mode-test.html
 create mode 100644 test/live-mode.html
 create mode 100644 test/mask-effects-test.html
 create mode 100644 test/parser-tests.html
 create mode 100644 test/professional-vocal-analyzer.html
 create mode 100644 test/rtf-test.html
 create mode 100644 test/test-app-final.html
 create mode 100644 test/test-background-effects.html
 create mode 100644 test/test-bmp.html
 create mode 100644 test/test-drag-boundaries.html
 create mode 100644 test/test-face-mesh-fix.html
 create mode 100644 test/test-final-check.html
 create mode 100644 test/test-final-integration.html
 create mode 100644 test/test-integration.html
 create mode 100644 test/test-lyrics.rtf
 create mode 100644 test/test-main-app-fix.html
 create mode 100644 test/test-mirroring-debug.html
 create mode 100644 test/test-rtf-parser.html
 create mode 100644 test/test-selfie-segmentation-debug.html
 create mode 100644 test/text-background-demo.html
 create mode 100644 test/text-processor-v2.html
sidechaine@MacBook-Pro-Nikita beLive % gh repo create side-chaine/beLive --public --source . --remote origin --push --confirm || { echo "Ошибка создания репо"; exit 1; }
Flag --confirm has been deprecated, Pass any argument to skip confirmation prompt
✓ Created repository side-chaine/beLive on github.com
  https://github.com/side-chaine/beLive
✓ Added remote git@github.com:side-chaine/beLive.git
Перечисление объектов: 258, готово.
Подсчет объектов: 100% (258/258), готово.
При сжатии изменений используется до 4 потоков
Сжатие объектов: 100% (246/246), готово.
Запись объектов: 100% (258/258), 30.14 МиБ | 5.42 МиБ/с, готово.
Total 258 (delta 17), reused 0 (delta 0), pack-reused 0 (from 0)
remote: Resolving deltas: 100% (17/17), done.
To github.com:side-chaine/beLive.git
 * [new branch]      HEAD -> master
branch 'master' set up to track 'origin/master'.
✓ Pushed commits to git@github.com:side-chaine/beLive.git
sidechaine@MacBook-Pro-Nikita beLive % cat > README.md <<'MD'
heredoc> 

Last login: Wed Sep 24 17:40:41 on ttys000
sidechaine@MacBook-Pro-Nikita ~ % cd /Users/sidechaine/Documents/beLive || { echo "папка не найдена"; exit 1; }
sidechaine@MacBook-Pro-Nikita beLive % gh auth status || { echo "gh не авторизован"; exit 1; }
github.com
  ✓ Logged in to github.com account side-chaine (keyring)
  - Active account: true
  - Git operations protocol: ssh
  - Token: gho_************************************
  - Token scopes: 'admin:public_key', 'delete_repo', 'gist', 'read:org', 'repo'
sidechaine@MacBook-Pro-Nikita beLive % gh api -X DELETE /repos/side-chaine/beLive/branches/main/protection || true

{
  "message": "Branch not protected",
  "documentation_url": "https://docs.github.com/rest/branches/branch-protection#delete-branch-protection",
  "status": "404"
}
gh: Branch not protected (HTTP 404)
sidechaine@MacBook-Pro-Nikita beLive % gh repo view side-chaine/beLive --json name >/dev/null 2>&1 \
  && { echo "Удаляю remote repo side-chaine/beLive ..."; gh repo delete side-chaine/beLive --confirm; } \
  || echo "Remote repo не найден или уже удалён, продолжаю."

Удаляю remote repo side-chaine/beLive ...
Flag --confirm has been deprecated, use `--yes` instead
✓ Deleted repository side-chaine/beLive
sidechaine@MacBook-Pro-Nikita beLive % git worktree list 2>/dev/null | awk 'NR>1 {print $1}' | xargs -r -I{} git worktree remove {} || true
rm -rf .git

sidechaine@MacBook-Pro-Nikita beLive % rm -rf private-assets
sidechaine@MacBook-Pro-Nikita beLive % git init
hint: Using 'master' as the name for the initial branch. This default branch name
hint: is subject to change. To configure the initial branch name to use in all
hint: of your new repositories, which will suppress this warning, call:
hint:
hint: 	git config --global init.defaultBranch <name>
hint:
hint: Names commonly chosen instead of 'master' are 'main', 'trunk' and
hint: 'development'. The just-created branch can be renamed via this command:
hint:
hint: 	git branch -m <name>
hint:
hint: Disable this message with "git config set advice.defaultBranchName false"
Инициализирован пустой репозиторий Git в /Users/sidechaine/Documents/beLive/.git/
sidechaine@MacBook-Pro-Nikita beLive % git config user.name "Nikita Side-Chaine"
git config user.email "nikitosss007@gmail.com"
git add -A
git commit -m "chore: initial clean commit" -s

[master (корневой коммит) 5859341] chore: initial clean commit
 252 files changed, 128528 insertions(+)
 create mode 100644  .cursor/rules/optimization-roadmap.mdc
 create mode 100644 .eslintignore
 create mode 100644 .eslintrc.json
 create mode 100644 .github/CODEOWNERS
 create mode 100644 .github/ISSUE_TEMPLATE/bug_report.md
 create mode 100644 .github/ISSUE_TEMPLATE/feature_request.md
 create mode 100644 .github/ISSUE_TEMPLATE/issue_template.md
 create mode 100644 .github/ISSUE_TEMPLATE/research.md
 create mode 100644 .github/PULL_REQUEST_TEMPLATE.md
 create mode 100644 .github/PULL_REQUEST_TEMPLATE/pull_request_template.md
 create mode 100644 .github/dependabot.yml
 create mode 100644 .github/workflows.disabled/dco-placeholder.yml.disabled
 create mode 100644 .github/workflows.disabled/dco.yml.disabled
 create mode 100644 .github/workflows/dco-placeholder.yml
 create mode 100644 .github/workflows/deploy-pages.yml
 create mode 100644 .github/workflows/deploy.yml
 create mode 100644 .gitignore
 create mode 100644 BUG_FIX_ROADMAP.md
 create mode 100644 Concert/pexels-apasaric-2078071.jpg
 create mode 100644 Concert/pexels-jackgittoes-761543.jpg
 create mode 100644 Concert/pexels-mark-angelo-sampan-738078-1587927.jpg
 create mode 100644 Concert/pexels-markusspiske-92078.jpg
 create mode 100644 Concert/pexels-picjumbo-com-55570-196652.jpg
 create mode 100644 Concert/pexels-rahulp9800-1652353.jpg
 create mode 100644 Concert/pexels-teddy-2263436.jpg
 create mode 100644 Concert/pexels-thibault-trillet-44912-167491.jpg
 create mode 100644 Concert/pexels-wendywei-1190297.jpg
 create mode 100644 Concert/pexels-wendywei-1677710.jpg
 create mode 100644 Docs/EXPORT_POC.md
 create mode 100644 Docs/PITCH_GUIDE.md
 create mode 100644 Docs/QUICK_START.md
 create mode 100644 IMPLEMENTATION_PLAN.md
 create mode 100644 INVENTORY.md
 create mode 100644 Karaoke/boliviainteligente-NFY0BeronrE-unsplash.jpg
 create mode 100644 Karaoke/bruno-cervera-Gi6-m_t_W-E-unsplash.jpg
 create mode 100644 Karaoke/kane-reinholdtsen-LETdkk7wHQk-unsplash.jpg
 create mode 100644 Karaoke/pexels-amit-batra-3062797-4658541.jpg
 create mode 100644 Karaoke/pexels-capturexpression-26530062.jpg
 create mode 100644 Karaoke/pexels-clemlep-13659549.jpg
 create mode 100644 Karaoke/pexels-isabella-mendes-107313-332688.jpg
 create mode 100644 Karaoke/pexels-katriengrevendonck-2101487.jpg
 create mode 100644 Karaoke/pexels-marcin-dampc-807808-1684187.jpg
 create mode 100644 Karaoke/pexels-maumascaro-1154189.jpg
 create mode 100644 Karaoke/pexels-mccutcheon-1191710.jpg
 create mode 100644 Karaoke/pexels-pixabay-164879.jpg
 create mode 100644 Karaoke/pexels-pixabay-164960.jpg
 create mode 100644 Karaoke/pexels-suvan-chowdhury-37305-144429.jpg
 create mode 100644 Karaoke/pexels-trinitykubassek-341858.jpg
 create mode 100644 Karaoke/prince-abid-LeZItQhwFks-unsplash.jpg
 create mode 100644 Karaoke/yichen-wang-aBeTfQ65ycQ-unsplash.jpg
 create mode 100644 LICENSE
 create mode 100644 PROJECT_OVERVIEW_FOR_AI_COUNCIL.md
 create mode 100644 README.md
 create mode 100644 ROADMAP.md
 create mode 100644 Rehearsal/.gitkeep
 create mode 100644 Rehearsal/4b8023db-3000-4084-bef9-b7aec2a804da.jpg
 create mode 100644 Rehearsal/README.txt
 create mode 100644 Rehearsal/didzhej_muzyka_diskoteka_160929_2560x1440.jpg
 create mode 100644 Rehearsal/dj_naushniki_ustanovka_122020_2560x1440.jpg
 create mode 100644 Rehearsal/dvoichnyj_kod_kod_tsifry_147523_2560x1440.jpg
 create mode 100644 Rehearsal/fotoapparat_obektiv_remeshok_145518_1600x900.jpg
 create mode 100644 Rehearsal/gitara_bas_gitara_struny_106722_2560x1440.jpg
 create mode 100644 Rehearsal/krolik_naushniki_muzyka_130283_2560x1440.jpg
 create mode 100644 Rehearsal/muzykalnyj_instrument_muzyka_udarnye_106370_2560x1440.jpg
 create mode 100644 Rehearsal/naushniki_knigi_obrazovanie_121501_2560x1600.jpg
 create mode 100644 Rehearsal/naushniki_ustanovka_muzyka_104587_1280x1024.jpg
 create mode 100644 Rehearsal/noty_griaznyj_bumaga_124163_2560x1440.jpg
 create mode 100644 Rehearsal/pexels-antonh-145707.jpg
 create mode 100644 Rehearsal/pexels-bclarkphoto-1135995.jpg
 create mode 100644 Rehearsal/pexels-conojeghuo-375893.jpg
 create mode 100644 Rehearsal/pexels-david-bartus-43782-844928.jpg
 create mode 100644 Rehearsal/pexels-didsss-1653090.jpg
 create mode 100644 Rehearsal/pexels-everson-mayer-478307-1481309.jpg
 create mode 100644 Rehearsal/pexels-joshsorenson-995301.jpg
 create mode 100644 Rehearsal/pexels-nikita-khandelwal-178978-632656.jpg
 create mode 100644 Rehearsal/pexels-pixabay-159376.jpg
 create mode 100644 Rehearsal/pexels-pixabay-159613.jpg
 create mode 100644 Rehearsal/pexels-pixabay-164716.jpg
 create mode 100644 Rehearsal/pexels-pixabay-164769.jpg
 create mode 100644 Rehearsal/pexels-pixabay-164853.jpg
 create mode 100644 Rehearsal/pexels-pixabay-164938.jpg
 create mode 100644 Rehearsal/pexels-pixabay-210766.jpg
 create mode 100644 Rehearsal/pexels-pixabay-257904.jpg
 create mode 100644 Rehearsal/pexels-pixabay-270288.jpg
 create mode 100644 Rehearsal/pexels-pixabay-290660.jpg
 create mode 100644 Rehearsal/pexels-reneterp-1327430.jpg
 create mode 100644 Rehearsal/soty_obem_zheleznyj_167098_2560x1440.jpg
 create mode 100644 Rehearsal/vinilovaia_plastinka_tonarm_kartridzh_107810_2560x1440.jpg
 create mode 100644 SECURITY.md
 create mode 100644 assets/fonts/oswald-bold.ttf
 create mode 100644 assets/fonts/oswald-regular.ttf
 create mode 100644 code_of_conduct.md
 create mode 100644 continue.config.example.yaml
 create mode 100644 contributing.md
 create mode 100644 css/avatar-page.css
 create mode 100644 css/block_editor.css
 create mode 100644 css/bmp-styles.css
 create mode 100644 css/catalog-v2.css
 create mode 100644 css/catalog.css
 create mode 100644 css/concert-styles.css
 create mode 100644 css/conveyor-styles.css
 create mode 100644 css/font-selector.css
 create mode 100644 css/fonts.css
 create mode 100644 css/home-button-enhanced.css
 create mode 100644 css/karaoke-styles.css
 create mode 100644 css/live-mode.css
 create mode 100644 css/loop-button-styles.css
 create mode 100644 css/main.css
 create mode 100644 css/mode-buttons-override.css
 create mode 100644 css/rehearsal-styles.css
 create mode 100644 css/style.css
 create mode 100644 css/styles.css
 create mode 100644 css/styles.css.backup
 create mode 100644 css/styles.css.bak
 create mode 100644 css/styles.css.bak2
 create mode 100644 css/transport-controls.css
 create mode 100644 css/waveform-source-switcher.css
 create mode 100644 dco-test-2.txt
 create mode 100644 dco-test.txt
 create mode 100644 eslint.config.cjs
 create mode 100644 eslint.config.mjs
 create mode 100644 img/masks/blue.png
 create mode 100644 img/masks/blur.png
 create mode 100644 img/masks/concert.png
 create mode 100644 img/masks/gradient.png
 create mode 100644 img/masks/grayscale.png
 create mode 100644 img/masks/green.png
 create mode 100644 img/masks/matrix.png
 create mode 100644 img/masks/nature.png
 create mode 100644 img/masks/neon.png
 create mode 100644 img/masks/none.png
 create mode 100644 img/masks/party.png
 create mode 100644 img/masks/placeholder.png
 create mode 100644 img/masks/sepia.png
 create mode 100644 img/masks/stars.png
 create mode 100644 img/masks/studio.png
 create mode 100644 img/masks/sunset.png
 create mode 100644 img/masks/vintage.png
 create mode 100644 index.html
 create mode 100644 inventory.json
 create mode 100644 js/.!33560!mask-system.js
 create mode 100644 js/app.js
 create mode 100644 js/audio-engine.js
 create mode 100644 js/audio-engine/README.md
 create mode 100644 js/audio-source-adapter.js
 create mode 100644 js/auto-integrator.js
 create mode 100644 js/background-effects-engine.js
 create mode 100644 js/block-loop-control.js
 create mode 100644 js/block_editor.js
 create mode 100644 js/catalog-v2.js
 create mode 100644 js/catalog.js
 create mode 100644 js/color-service.js
 create mode 100644 js/concert-background.js
 create mode 100644 js/constants.js
 create mode 100644 js/creative-masks.js
 create mode 100644 js/debug-config.js
 create mode 100644 js/dev-flags.js
 create mode 100644 js/drag-boundary-controller.js
 create mode 100644 js/enhanced-rtf-processor.js
 create mode 100644 js/enhanced-text-editor-fixed.js
 create mode 100644 js/enhanced-text-processor.js
 create mode 100644 js/karaoke-background.js
 create mode 100644 js/lib/audio-context.js
 create mode 100644 js/lib/audio-engine.js
 create mode 100644 js/lib/face-mesh.js
 create mode 100644 js/lib/live-masks.js
 create mode 100644 js/lib/utils.js
 create mode 100644 js/lib/video-processor.js
 create mode 100644 js/live-feed.js
 create mode 100644 js/live-mode.js
 create mode 100644 js/logger.js
 create mode 100644 js/loopblock-manager.js
 create mode 100644 js/lyrics-display.js
 create mode 100644 js/lyrics-display.js.bak
 create mode 100644 js/lyrics-display.js.bak2
 create mode 100644 js/lyrics-display.js.migration-backup
 create mode 100644 js/main.js
 create mode 100644 js/marker-manager.js
 create mode 100644 js/mask-system.js
 create mode 100644 js/modal-block-editor.js
 create mode 100644 js/piano-keyboard-backup.js
 create mode 100644 js/piano-keyboard-backup2.js
 create mode 100644 js/piano-keyboard-backup3.js
 create mode 100644 js/piano-keyboard-backup4.js
 create mode 100644 js/piano-keyboard-fix.js
 create mode 100644 js/piano-keyboard-fixed.js
 create mode 100644 js/piano-keyboard-improvements.js
 create mode 100644 js/piano-keyboard-integration-plan.md
 create mode 100644 js/piano-keyboard-lookahead.js
 create mode 100644 js/piano-keyboard-manual-fix.js
 create mode 100644 js/piano-keyboard-nav-fix.js
 create mode 100644 js/piano-keyboard-patch.js
 create mode 100644 js/piano-keyboard.js
 create mode 100644 js/piano-keyboard.js.bak
 create mode 100644 js/rehearsal-background.js
 create mode 100644 js/rtf-parser-adapter.js
 create mode 100644 js/rtf-parser-integration.js
 create mode 100644 js/rtf-parser.js
 create mode 100644 js/rtf-parser.js.backup
 create mode 100644 js/rtf-simple-parser.js
 create mode 100644 js/state-manager.js
 create mode 100644 js/text-processor-integrator.js
 create mode 100644 js/text-processor.js
 create mode 100644 js/text-style-manager.js
 create mode 100644 js/track-catalog.js
 create mode 100644 js/utils.js
 create mode 100644 js/vendor/face-landmarks-detection.min.js
 create mode 100644 js/vendor/tf-backend-webgl.min.js
 create mode 100644 js/vendor/tf-core.min.js
 create mode 100644 js/vendor/three.min.js
 create mode 100644 js/view-manager.js
 create mode 100644 js/waveform-editor.js
 create mode 100644 package-lock.json
 create mode 100644 package.json
 create mode 100644 resources/masks/confetti.svg
 create mode 100644 resources/masks/glasses1.svg
 create mode 100644 resources/masks/glasses2.svg
 create mode 100644 resources/masks/hat1.svg
 create mode 100644 resources/masks/mustache.svg
 create mode 100644 resources/masks/rainbow.svg
 create mode 100644 rtf-parser.js
 create mode 100644 test/avatar-carrier-curator.html
 create mode 100644 test/avatar-page-cockpit-pro.html
 create mode 100644 test/avatar-page-final.html
 create mode 100644 test/avatar-page-gemini.html
 create mode 100644 test/avatar-page-modern.html
 create mode 100644 test/block-editor-undo.html
 create mode 100644 test/catalog-design-test.html
 create mode 100644 test/concept1-live-feed.html
 create mode 100644 test/live-avatar-poc.html
 create mode 100644 test/live-masks-demo.html
 create mode 100644 test/live-mode-test.html
 create mode 100644 test/live-mode.html
 create mode 100644 test/mask-effects-test.html
 create mode 100644 test/parser-tests.html
 create mode 100644 test/professional-vocal-analyzer.html
 create mode 100644 test/rtf-test.html
 create mode 100644 test/test-app-final.html
 create mode 100644 test/test-background-effects.html
 create mode 100644 test/test-bmp.html
 create mode 100644 test/test-drag-boundaries.html
 create mode 100644 test/test-face-mesh-fix.html
 create mode 100644 test/test-final-check.html
 create mode 100644 test/test-final-integration.html
 create mode 100644 test/test-integration.html
 create mode 100644 test/test-lyrics.rtf
 create mode 100644 test/test-main-app-fix.html
 create mode 100644 test/test-mirroring-debug.html
 create mode 100644 test/test-rtf-parser.html
 create mode 100644 test/test-selfie-segmentation-debug.html
 create mode 100644 test/text-background-demo.html
 create mode 100644 test/text-processor-v2.html
sidechaine@MacBook-Pro-Nikita beLive % gh repo create side-chaine/beLive --public --source . --remote origin --push --confirm || { echo "Ошибка создания репо"; exit 1; }
Flag --confirm has been deprecated, Pass any argument to skip confirmation prompt
✓ Created repository side-chaine/beLive on github.com
  https://github.com/side-chaine/beLive
✓ Added remote git@github.com:side-chaine/beLive.git
Перечисление объектов: 258, готово.
Подсчет объектов: 100% (258/258), готово.
При сжатии изменений используется до 4 потоков
Сжатие объектов: 100% (246/246), готово.
Запись объектов: 100% (258/258), 30.14 МиБ | 5.42 МиБ/с, готово.
Total 258 (delta 17), reused 0 (delta 0), pack-reused 0 (from 0)
remote: Resolving deltas: 100% (17/17), done.
To github.com:side-chaine/beLive.git
 * [new branch]      HEAD -> master
branch 'master' set up to track 'origin/master'.
✓ Pushed commits to git@github.com:side-chaine/beLive.git
sidechaine@MacBook-Pro-Nikita beLive % cat > README.md <<'MD'
heredoc> 
md
