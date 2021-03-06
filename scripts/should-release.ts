/**
 * npm run should-release
 * 超イケてるなんでもやるスクリプト.
 * TODO: 秘伝のタレすぎる...
 *
 * NODE_ENV=productionのときは、
 *   "RELEASE PR" についてるコメントを見て、
 *   プロダクションリリースすべきか判断し、
 *   ツイートすべきannouncement.txtを作成.
 *
 * NODE_ENV=stagingのときは、
 *   直近のタグからアプリケーションの更新があるか見て、
 *   テストリリースすべきか判断し、
 *   タグを付けてPUSH BACKし、
 *   ツイートすべきannouncement.txtを作成.
 */

// const core = require("@actions/core");
// const github = require("@actions/github");
// const shell = require("child_process");
// const fs = require("fs").promises;

import * as core from "@actions/core";
import { getOctokit } from "@actions/github";
import * as shell from "child_process";
import { promises as fs } from "fs";
import { messages } from "./messages";

const RELEASE_APPROVAL_EXPRESSION = /(^👍|^:\+1:|^\+1|^:shipit:|^LGTM)/i;

/**
 * countReactionOnReleasePR
 * @param {issue_number: number} pr
 * @param {Regexp} EXPRESSION
 */
async function countReactionOnReleasePR(
  pr: { number: number },
  EXPRESSION = RELEASE_APPROVAL_EXPRESSION,
): Promise<{ [user: string]: number }> {
  const octokit = getOctokit(process.env.GITHUB_TOKEN).rest;
  const owner = "KanCraft", repo = "kanColleWidget";
  const { data: comments } = await octokit.issues.listComments({ owner, repo, issue_number: pr.number });
  const { data: reactions } = await octokit.reactions.listForIssue({ owner, repo, issue_number: pr.number });
  if (comments.length == 0 && reactions.length == 0) return {};
  return ([...comments, ...reactions] as { body?: string, content?: string, user: { login: string } }[]).reduce((ctx, com) => {
    if (EXPRESSION.test(com.body || com.content)) ctx[com.user.login] = (ctx[com.user.login] || 0) + 1;
    return ctx;
  }, {});
}

async function getReleasePR(octokit, owner = "KanCraft", repo = "kanColleWidget", head = "develop", base = "main", state = "open") {
  const pulls = await octokit.pulls.list({ repo, owner, head, base, state });
  return pulls.data.filter(pr => pr.head.ref == head && pr.base.ref == base)[0];
}

const REQUIRED_LGTM_FOR_PRODUCTION_RELEASE = 3;
function getReleasePRAnnounce(pr, count) {
  return (
    "自動リリースプロセスがOPENしています。\n"
    + "テストユーザ各位は、テストリリースに問題が無ければ、下記リンクのコメント欄に「👍」とコメントしてください。\n"
    + `${REQUIRED_LGTM_FOR_PRODUCTION_RELEASE}人以上の 👍 が集まると自動で本番環境へリリースされます！\n`
    + `${count ? ("（現在 " + count + "人）") : ""}\n`
    + `> ${pr.title}\n#艦これウィジェット\n`
    + pr.html_url
  );
}

function formatTweetStatus(header, commits: { commit: { message: string } }[], hashtag, suffix = "") {
  const MAX_LENGTH = 140;
  const lines: string[] = commits.map(c => c.commit.message.split("\n")[0]);
  const status = `${header}\n${lines.join("\n")}\n${suffix}\n${hashtag}`;
  if (status.length < MAX_LENGTH) return status;
  return formatTweetStatus(header, commits.slice(0, -1), hashtag, "など");
}

function createStageReleaseAnnounce(
  LATEST_TAG: string,
  NEW_TAG: string,
  commits: { commit: { message: string } }[],
) {
  // const commits = shell.execSync(`git log --pretty="%s" --no-merges ${LATEST_TAG}..HEAD`).toString().trim().split("\n");
  return formatTweetStatus(`[テスト版リリース] ${NEW_TAG}`, commits, "#艦これウィジェット");
}

async function writeAnnouncement(announce) {
  const fname = "./announcement.txt";
  await fs.writeFile(fname, announce);
}

async function getNextVersion() {
  const manifest = JSON.parse((await fs.readFile("./manifest.json")).toString());
  const [major, minor, patch] = manifest.version.split(".").map(s => parseInt(s, 10));
  return `${major}.${minor}.${patch + 1}`;
}

async function updateVersion(next_version) {
  // manifest.json
  const manifest = JSON.parse((await fs.readFile("./manifest.json")).toString());
  manifest.version = next_version;
  manifest.version_name = next_version;
  await fs.writeFile("./manifest.json", JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  // package.json
  const pkg = JSON.parse((await fs.readFile("./package.json")).toString());
  pkg.version = next_version;
  await fs.writeFile("./package.json", JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  // package-lock.json
  const lock = JSON.parse((await fs.readFile("./package-lock.json")).toString());
  lock.version = next_version;
  await fs.writeFile("./package-lock.json", JSON.stringify(lock, null, 2) + "\n", "utf-8");
}

/**
 * テストリリースで、 **リリースするべき** コミットをフィルタする
 */
function filterStageReleaseCommits({ commit, author }): boolean {
  if (commit.message.startsWith("Merge pull request")) return false;
  const skipAuthors = ["ayanel-ci"];
  if (skipAuthors.includes(author.login)) return false;
  core.info(`RELEASE: ${commit.message.split("\n")[0]}`);
  return true;
}

/**
 * テストリリースで、 **アナウンスするべき** コミットをフィルタする
 */
function filterStageAnnounceCommits({ commit, author }: { commit: { message: string }, author: { login: string } }): boolean {
  if (commit.message.startsWith("Merge pull request")) return false;
  const skipAuthors = ["ayanel-ci", "dependabot[bot]"];
  if (skipAuthors.includes(author.login)) return false;
  core.info(`ANNOUNCE: ${commit.message.split("\n")[0]}`);
  return true;
}

/**
 * developに更新が無く、とくに言うことが無いときのメッセージを取得する.
 */
function getEmptyMessage(): string {
  if (Math.random() > 0.2) return "開発鎮守府海域、異常なし.";
  const emptyMessages = messages["empty-commit"];
  return emptyMessages[Math.floor(Math.random() * emptyMessages.length)];
}

// テスト用Chrome拡張をWebStoreにリリースするかどうか決める.
// - トリガ: 定期
// - 条件: 最新のtagから、現在のdevelopブランチに差分があるかどうかで判断.
// - SHOULD_RELEASE_STAGE=yes
// - NEW_TAG=3.2.2
// - 副作用: タグをつけてpush backする
async function shouldReleaseStage() {
  const BRANCH = "develop";
  const owner = "KanCraft", repo = "kanColleWidget";
  const head = BRANCH, base = "main";
  const octokit = getOctokit(process.env.GITHUB_TOKEN).rest;

  // 直近タグを取得
  const LATEST_TAG = shell.execSync("git describe --tags --abbrev=0").toString().trim();
  const LATEST_TAG_SHA = shell.execSync(`git show-ref -s ${LATEST_TAG}`).toString().trim();
  core.debug(`LATEST_TAG: ${LATEST_TAG}\t${LATEST_TAG_SHA}`);

  // 直近タグからのコミットリスト取得
  const { data: tag } = await octokit.git.getCommit({ owner, repo, commit_sha: LATEST_TAG_SHA });
  const { data: all } = await octokit.repos.listCommits({ owner, repo, sha: BRANCH, since: tag.author.date });

  // リリースすべきコミットをフィルタ
  const releasecommits = all.filter(filterStageReleaseCommits);

  // すでに開いているリリースPRを取得
  const pulls = await octokit.pulls.list({ repo, owner, head, base, state: "open" });
  const pr = pulls.data.filter(pr => pr.head.ref == head && pr.base.ref == base)[0];

  // 直近のコミットが無い場合はテストリリースをスキップする
  if (releasecommits.length == 0) {
    if (!pr) return await writeAnnouncement(getEmptyMessage());
    const reactions = await countReactionOnReleasePR(pr);
    return await writeAnnouncement(getReleasePRAnnounce(pr, Object.keys(reactions).length));
  }

  // 次のタグを決定
  const NEW_TAG = await getNextVersion();

  // リリースアナウンスを作成
  const announcecommits = all.filter(filterStageAnnounceCommits);
  if (announcecommits.length) {
    await writeAnnouncement(createStageReleaseAnnounce(LATEST_TAG, NEW_TAG, announcecommits));
  }

  if (!process.env.GITHUB_WORKFLOW) return core.debug("終了");

  // jsonファイルをedit
  await updateVersion(NEW_TAG);

  // 次のタグのバージョンをコミットする
  const body = releasecommits.map(c => `${c.sha} ${c.commit.message.split("\n")[0]}`).join("\n");
  const files = ["package.json", "package-lock.json", "manifest.json"];
  shell.execSync(`git add ${files.join(" ")}`);
  shell.execSync(`git commit -m '${NEW_TAG}' -m '${body}'`);
  shell.execSync(`git tag ${NEW_TAG}`);

  // PUSH BACK する
  const { GITHUB_ACTOR, GITHUB_TOKEN, GITHUB_REPOSITORY } = process.env;
  const REPO = `https://${GITHUB_ACTOR}:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git`;
  shell.execSync(`git push "${REPO}" HEAD:${BRANCH} --tags --follow-tags`);

  // 後続ステップのためにフラグを立てる
  core.exportVariable("SHOULD_RELEASE_STAGE", "yes");
  core.exportVariable("NEW_TAG", NEW_TAG);

  // 確認
  core.info(`LATEST_TAG: ${LATEST_TAG}`);
  core.info(`COMMITS: ${releasecommits.length}`);
  core.info(`NEW_TAG: ${NEW_TAG}`);
}

// 本番用Chrome拡張をWebStoreにリリースするかどうか決める.
// - トリガ: "RELEASE PR" 上でのコメント
// - 条件: コメントに一定数以上の :+1: または :shipit: を含む
// - SHOULD_RELEASE_PRODUCTION=yes
async function shouldReleaseProduction() {
  // const { repo, owner } = github.context.repo;
  const owner = "KanCraft", repo = "kanColleWidget";
  const octokit = getOctokit(process.env.GITHUB_TOKEN).rest;
  const pr = await getReleasePR(octokit);
  if (!pr) return core.info("リリースPRがopenされていない");
  // if (pr.number != process.env.ISSUE_NUMBER) return console.log("[INFO]", "RELEASE PR 上のコメントではない");
  core.debug(`pr.number == ISSUE_NUMBER: ${pr.number} == ${process.env.ISSUE_NUMBER}`);

  const summary = await countReactionOnReleasePR(pr);
  core.info(`SUMMARY:\n${summary}`);
  const reviewers = Object.keys(summary);

  if (!process.env.GITHUB_WORKFLOW) return core.debug("終了");

  if (reviewers.length < REQUIRED_LGTM_FOR_PRODUCTION_RELEASE) return core.info(`LGTM: ${reviewers.length}`);
  const body = `${reviewers.length}人の「👍」が集まったのでマージし、プロダクションリリースします！\n`
    + `Thank you! ${reviewers.map(name => "@" + name).join(", ")}`;
  await octokit.issues.createComment({ repo, owner, issue_number: pr.number, body });
  await octokit.pulls.merge({ repo, owner, pull_number: pr.number });

  // {{{ リリースを作成
  const LATEST_TAG = shell.execSync("git describe --tags --abbrev=0").toString().trim();
  core.exportVariable("RELEASE_TAG", LATEST_TAG);
  core.exportVariable("SHOULD_RELEASE_PRODUCTION", "yes");
  const { data: release } = await octokit.repos.createRelease({ repo, owner, tag_name: LATEST_TAG, name: LATEST_TAG, body: pr.body.split("\n").slice(2).join("\n") });
  core.exportVariable("RELEASE_URL", release.html_url);
  core.exportVariable("RELEASE_UPLOAD_URL", release.upload_url);
  // }}}
}

async function main() {
  if (process.env.NODE_ENV == "production") {
    // issue_comment: [created, deleted] でトリガする想定
    await shouldReleaseProduction();
  } else {
    // schedule: cron でトリガする想定
    await shouldReleaseStage();
  }
}

if (require.main === module) {
  main();
}