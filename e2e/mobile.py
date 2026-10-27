"""Mobile smoke: 400px viewport, open the drawer, ask, open evidence. Writes docs/screenshots/10-mobile-*.png."""
import asyncio
import pathlib
import sys

from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4311"
OUT = pathlib.Path(__file__).resolve().parent.parent / "docs" / "screenshots"


async def main() -> int:
    errors: list[str] = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 400, "height": 820}, device_scale_factor=2)
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(BASE, wait_until="networkidle")
        await page.wait_for_timeout(600)
        await page.screenshot(path=OUT / "10-mobile-hero.png")
        await page.get_by_role("button", name="Open conversations").click()
        await page.wait_for_timeout(400)
        await page.screenshot(path=OUT / "10-mobile-drawer.png")
        await page.get_by_role("button", name="Close conversations").click(position={"x": 395, "y": 400})
        await page.wait_for_timeout(400)
        await page.get_by_role("button", name="Which regulations govern leave in Mexico?").click()
        await page.wait_for_function("() => document.querySelector('.assistant') && !document.querySelector('.assistant.streaming')", timeout=20000)
        await page.get_by_role("button", name="Evidence").first.click()
        await page.wait_for_selector("app-graph-force svg g", timeout=10000)
        await page.wait_for_timeout(2400)
        await page.locator("app-evidence").scroll_into_view_if_needed()
        await page.screenshot(path=OUT / "10-mobile-evidence.png")
        await browser.close()
    print(f"console errors: {len(errors)}")
    for e in errors:
        print("  -", e[:300])
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
