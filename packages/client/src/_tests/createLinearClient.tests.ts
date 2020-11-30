import { createLinearClient } from "../index";
import { createTestServer, MOCK_API_KEY } from "./_mock";

const ctx = createTestServer();

describe("createLinearClient", () => {
  beforeAll(() => {
    ctx.res({
      body: {
        data: {
          viewer: { id: "viewerId" },
          team: {
            id: "teamId",
            labels: { nodes: [{ id: "labelId" }] },
            states: { nodes: [{ id: "stateId" }] },
          },
        },
      },
    });
  });

  it("makes query to baseUrl", async () => {
    const client = createLinearClient({ apiKey: MOCK_API_KEY, baseUrl: ctx.url });
    const response = await client.viewer();

    expect(response).toEqual(expect.objectContaining({ id: "viewerId" }));
  });

  it("has chained api", async () => {
    const client = createLinearClient({ apiKey: MOCK_API_KEY, baseUrl: ctx.url });
    const team = await client.team("someTeamId");
    // const labels = await team.labels();
    // const states = await team.states();

    expect(team).toEqual(expect.objectContaining({ id: "teamId" }));
    // expect(labels.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ id: "labelId" })]));
    // expect(states.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ id: "stateId" })]));
  });

  it("fails auth with incorrect api key", async () => {
    const client = createLinearClient({ apiKey: "asd", baseUrl: ctx.url });

    try {
      await client.viewer();
    } catch (error) {
      expect(error.message).toEqual(expect.stringContaining("401"));
    }
  });
});