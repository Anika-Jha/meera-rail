import { ParsedNoticeSchema, type ParsedNotice } from "./schema.js";

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

export function parseNotice(input: string): ParsedNotice {
  const notice = input.trim();

  if (!notice) {
    throw new ParseError("Notice is empty");
  }

  if (notice.length > 5000) {
    throw new ParseError("Notice exceeds the 5000 character limit");
  }

  const trainMatch = notice.match(/\b(?:train|गाड़ी|गाडी)\s*(?:no\.?\s*)?(\d{4,6})\b/i);

  const stationMatch = notice.match(
    /\b(?:at|station|स्टेशन|स्थानक)\s+([A-Z]{2,6})\b/i
  );

  const timeMatch = notice.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);

  if (!trainMatch) {
    throw new ParseError("Could not identify the train number");
  }

  if (!stationMatch) {
    throw new ParseError("Could not identify the station code");
  }

  if (!timeMatch) {
    throw new ParseError("Could not identify the expected time");
  }

  const reasonMatch = notice.match(
    /(?:delay due to|due to|because of|कारण|मुळे)\s+(.+?)(?:\.|$)/i
  );

  const result = {
    train: trainMatch[1],
    station: stationMatch[1].toUpperCase(),
    expectedTime: `${timeMatch[1]}:${timeMatch[2]}`,
    reason: reasonMatch?.[1]?.trim() || null,
  };

  const validated = ParsedNoticeSchema.safeParse(result);

  if (!validated.success) {
    throw new ParseError("Parser produced invalid structured data");
  }

  return validated.data;
}