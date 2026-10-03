#!/usr/bin/env node
import { crewManifests, createAppUrl } from "./manifest.js";

for (const { role, manifest } of crewManifests()) {
  console.log(`\n# ${role.displayName}`);
  console.log(createAppUrl(manifest));
}
