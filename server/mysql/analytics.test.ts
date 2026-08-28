import assert from "node:assert/strict";
import test from "node:test";
import { cleanupAnalyticsEvents, verifyAnalyticsPersistence } from "./analytics";

test("verifies the persistent analytics table before production serves traffic", async () => {
  const calls: string[] = [];
  await verifyAnalyticsPersistence({
    select() {
      calls.push("select");
      return {
        from() {
          calls.push("from");
          return {
            async limit(value: number) {
              calls.push(`limit:${value}`);
              return [];
            },
          };
        },
      };
    },
  });

  assert.deepEqual(calls, ["select", "from", "limit:1"]);
});

test("surfaces a missing analytics table during startup verification", async () => {
  await assert.rejects(
    verifyAnalyticsPersistence({
      select() {
        return {
          from() {
            return {
              async limit() {
                throw new Error("Table 'analytics_events' doesn't exist");
              },
            };
          },
        };
      },
    }),
    /analytics_events/,
  );
});

test("MySQL analytics cleanup deletes events before the retention cutoff", async () => {
  let whereCalled = false;
  const removed = await cleanupAnalyticsEvents({
    delete() {
      return {
        async where(condition: unknown) {
          assert.ok(condition);
          whereCalled = true;
          return [{ affectedRows: 4 }];
        },
      };
    },
  });
  assert.equal(whereCalled, true);
  assert.equal(removed, 4);
});