export const OPENAI_APPS_CHALLENGE_TOKEN =
  "SvEQbJS0jFqTbLGaRp6ujz1aSS0zvGQzrn_noRB3wDc";

export const dynamic = "force-static";

export function GET() {
  return new Response(OPENAI_APPS_CHALLENGE_TOKEN, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
