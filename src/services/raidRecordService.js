const RaidRecord = require("../models/raidRecord");
const { bossRaidCache } = require("../cache/raidRecordCache");

const error = require("../middlewares/errorConstructor");

const recordRaidInCache = (userId, raidRecordId, level) => {
  bossRaidCache.set(
    "inBossRaid",
    {
      userId,
      raidRecordId,
      level,
    },
    {
      ttl: 180 * 1000,
    }
  );
  bossRaidCache.set("recentEntered", {
    userId,
    raidRecordId,
    level,
  });
};

const getRecordsByuserId = async (userId) => {
  const records = await RaidRecord.findAll(
    {
      attributes: { exclude: ["userId"] },
    },
    {
      where: {
        userId,
      },
      order: [["enterTime", "DESC"]],
    }
  );
  return records;
};

const checkBossRaid = async () => {
  const returnStatus = { canEnter: true };
  const inBossRaid = bossRaidCache.get("inBossRaid");

  if (!inBossRaid) {
    return returnStatus;
  }

  returnStatus.canEnter = false;

  return returnStatus;
};

const enterRaid = async (req) => {
  try {
    const { userId, level } = req.body;
    const raidStatus = { isEntered: false };
    const startTime = new Date();

    const inBossRaid = bossRaidCache.get("inbossRaid");
    if (inBossRaid) {
      return raidStatus;
    }

    const newRaidRecord = await RaidRecord.create({
      userId,
      enterTime: startTime,
    });

    recordRaidInCache(userId, newRaidRecord.raidRecordId, level);
    raidStatus.raidRecordId = newRaidRecord.raidRecordId;
    raidStatus.isEntered = true;
    return raidStatus;
  } catch (err) {
    console.error(err.name, err.statusCode, err.message);

    if (err.name === "SequelizeForeignKeyConstraintError") {
      throw new error("Invalid User", 400);
    } else {
      throw new error("ServerError", 500);
    }
  }
};

const endRaid = async (req) => {
  const { userId, raidRecordId } = req.body;
  const inBossRaid = bossRaidCache.get("inBossRaid");
  if (!inBossRaid) {
    throw new error("Timeout", 404);
  }
  if (
    userId !== inBossRaid.userId ||
    raidRecordId !== inBossRaid.raidRecordId
  ) {
    throw new error("Incorrect input", 409);
  }
  endTime = new Date();
  const raidRecord = await RaidRecord.update(
    { score: 10, endTime },
    {
      where: {
        raidRecordId: raidRecordId,
      },
    }
  );
  bossRaidCache.delete("inBossRaid");

  return raidRecord;
};

module.exports = { checkBossRaid, enterRaid, endRaid, getRecordsByuserId };
