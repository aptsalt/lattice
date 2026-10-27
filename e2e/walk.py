"""Smoke walk: load the app, ask a question, open every evidence view, screenshot each state.

Run:  py -I e2e/walk.py [base_url]
Writes docs/screenshots/*.png and prints console errors (expects none).
"""
import asyncio
import pathlib
import sys

from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4311"
OUT = pathlib.Path(__file__).resolve().parent.parent / "docs" / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)


async def main() -> int:
    errors: list[str] = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        await page.goto(BASE, wait_until="networkidle")
        await page.wait_for_timeout(800)
        await page.screenshot(path=OUT / "01-hero.png")

        # ask via a suggestion chip
        await page.get_by_role("button", name="How many vacation days does a new full-time employee in Mexico get?").click()
        await page.wait_for_selector("text=confidence:", timeout=15000)
        await page.wait_for_function("() => !document.querySelector('.assistant.streaming')", timeout=20000)
        await page.wait_for_timeout(300)
        await page.screenshot(path=OUT / "02-answer.png")

        # open evidence (force)
        await page.get_by_role("button", name="Evidence").first.click()
        await page.wait_for_selector("app-graph-force svg g", timeout=10000)
        await page.wait_for_timeout(3600)
        await page.locator("app-evidence").scroll_into_view_if_needed()
        await page.screenshot(path=OUT / "03-evidence-force.png")

        for variant, selector in [("Radial", "app-graph-radial svg g"), ("Orbit", "app-graph-orbit canvas"), ("3D", "app-graph-three canvas"), ("Replay", "app-graph-trace")]:
            await page.get_by_role("radio", name=variant).click()
            await page.wait_for_selector(selector, timeout=10000)
            await page.wait_for_timeout(2600 if variant in ("Replay", "3D") else 1800)
            await page.locator("app-evidence").scroll_into_view_if_needed()
            await page.screenshot(path=OUT / f"04-evidence-{variant.lower()}.png")

        for tab in ["Facts", "Sources", "Cypher", "Trace"]:
            await page.get_by_role("tab", name=tab).click()
            await page.wait_for_timeout(400)
            await page.locator("app-evidence").scroll_into_view_if_needed()
            await page.screenshot(path=OUT / f"05-evidence-{tab.lower()}.png")

        # contextual help on the Cypher tab
        await page.get_by_role("tab", name="Cypher").click()
        await page.get_by_role("button", name="What is this tab?").click()
        await page.wait_for_timeout(500)
        await page.screenshot(path=OUT / "11-help-cypher.png")
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(300)

        # follow-up with context on
        await page.get_by_role("button", name="And in Canada?").click()
        await page.wait_for_function("() => document.querySelectorAll('.assistant').length === 2 && !document.querySelector('.assistant.streaming')", timeout=20000)
        await page.wait_for_timeout(300)
        await page.locator(".assistant").last.scroll_into_view_if_needed()
        await page.screenshot(path=OUT / "06-followup.png")

        # composer menus
        await page.get_by_title("Retrieval mode").click()
        await page.wait_for_timeout(300)
        await page.screenshot(path=OUT / "07-mode-menu.png")
        await page.keyboard.press("Escape")

        # light theme
        await page.get_by_role("button", name="Toggle theme").click()
        await page.wait_for_timeout(400)
        await page.screenshot(path=OUT / "08-light.png")
        await page.get_by_role("button", name="Toggle theme").click()

        # architecture and guide pages
        await page.get_by_role("link", name="Architecture").click()
        await page.wait_for_timeout(600)
        await page.screenshot(path=OUT / "09-architecture.png")
        await page.get_by_role("link", name="Guide").click()
        await page.wait_for_timeout(600)
        await page.screenshot(path=OUT / "12-guide.png")
        await page.locator("#cypher").scroll_into_view_if_needed()
        await page.wait_for_timeout(500)
        await page.screenshot(path=OUT / "12-guide-cypher.png")

        await browser.close()

    print(f"console errors: {len(errors)}")
    for e in errors:
        print("  -", e[:300])
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
