"use strict";

const REPOSITORY = "bigidrise/my-perfect-meals-npm-dev";
const FORBIDDEN = new Set(["refs/heads/main", "refs/heads/staging", "refs/heads/production"]);

function remoteIdentity(remote) {
  const scp = /^([^/@]+@)?([^/:]+):(.+)$/.exec(remote);
  let host, pathname;
  if (!remote.includes("://") && scp) {
    host = scp[2];
    pathname = scp[3];
  } else {
    const url = new URL(remote);
    host = url.hostname;
    pathname = url.pathname;
  }
  return {
    host: host.toLowerCase(),
    repository: pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "").toLowerCase(),
  };
}

function isCheckpoint(remoteName, remote) {
  return remoteName === "gitsafe-backup" &&
    /^git:\/\/gitsafe(?::[0-9]+)?\/backup\.git$/.test(remote);
}

function assertGitHub(remote, expectedRepository) {
  const identity = remoteIdentity(remote);
  if (!["github.com", "github.replit.internal"].includes(identity.host) ||
      (expectedRepository && identity.repository !== expectedRepository)) {
    throw new Error("Refusing push: destination is not the approved GitHub repository.");
  }
}

function checkUpdates(remoteName, remote, input, branch) {
  if (isCheckpoint(remoteName, remote)) return { checkpoint: true };
  assertGitHub(remote, REPOSITORY);
  const updates = input.trim() ? input.trim().split(/\r?\n/) : [];
  for (const update of updates) {
    const fields = update.trim().split(/\s+/);
    if (fields.length !== 4) throw new Error("Refusing push: malformed destination update.");
    const [localRef, localSha, remoteRef] = fields;
    if (FORBIDDEN.has(remoteRef)) {
      throw new Error(`Refusing direct GitHub update to ${remoteRef}. Use a founder-reviewed PR into production.`);
    }
    if (remoteRef === "refs/heads/dev" &&
        (branch !== "dev" || localRef !== "refs/heads/dev" || /^0+$/.test(localSha))) {
      throw new Error("GitHub dev updates must come from the local dev branch; deletion is forbidden.");
    }
  }
  return { checkpoint: false };
}

module.exports = { REPOSITORY, assertGitHub, isCheckpoint, checkUpdates };
