function getAddMessage(changeset) {
	return `Add changeset: ${changeset.summary}`;
}

function getVersionMessage(releasePlan) {
	const publishableReleases = releasePlan.releases.filter((release) => release.type !== "none");
	const releasesLines = publishableReleases
		.map((release) => `  ${release.name}@${release.newVersion}`)
		.join("\n");

	return `Release changes

Releases:
${releasesLines}
`;
}

module.exports = {
	getAddMessage,
	getVersionMessage,
};
