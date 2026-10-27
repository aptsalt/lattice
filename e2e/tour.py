"""Record a feature tour as video (webm) with Playwright.

Run:  py -I e2e/tour.py [base_url]
Then: ffmpeg -i docs/tour.webm -vf "fps=12,scale=1100:-1" docs/tour.gif  (or an mp4)
"""
import asyncio
import pathlib
import shutil
import sys

from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4311"
DOCS = pathlib.Path(__file__).resolve().parent.parent / "docs"
TMP = DOCS / "_video"


async def slow_type(page, text: str) -> None:
    ta = page.get_by_label("Your question")
    await ta.click()
    await ta.type(text, delay=28)


async def main() -> None:
    TMP.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900}, record_video_dir=str(TMP), record_video_size={"width": 1440, "height": 900})
        page = await ctx.new_page()
        await page.goto(BASE, wait_until="networkidle")
        await page.wait_for_timeout(1800)

        # 1. composer controls: open the mode menu, pick Hybrid, show the source menu
        await page.get_by_title("Retrieval mode").click()
        await page.wait_for_timeout(1400)
        await page.get_by_role("menuitemradio", name="Hybrid").click()
        await page.wait_for_timeout(600)
        await page.get_by_title("Data source").click()
        await page.wait_for_timeout(1200)
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(500)

        # 2. type a question and send
        await slow_type(page, "How many vacation days does a new full-time employee in Mexico get?")
        await page.wait_for_timeout(500)
        await page.keyboard.press("Enter")
        await page.wait_for_function("() => document.querySelector('.assistant') && !document.querySelector('.assistant.streaming')", timeout=20000)
        await page.wait_for_timeout(1500)

        # 3. click a citation → sources tab
        await page.locator(".cite").first.click()
        await page.wait_for_timeout(2200)

        # 4. subgraph views
        await page.get_by_role("tab", name="Subgraph").click()
        await page.wait_for_selector("app-graph-force svg g", timeout=10000)
        await page.wait_for_timeout(2600)
        node = page.locator("app-graph-force .node").filter(has_text="Mexico vacation entitle").first
        await node.hover(force=True)  # the simulation is still settling, so skip the stability check
        await page.wait_for_timeout(1800)
        await page.mouse.move(100, 100)
        await page.get_by_role("button", name="Focus").click()
        await page.wait_for_timeout(1600)
        await page.get_by_role("button", name="Focus").click()
        await page.wait_for_timeout(600)
        for variant, wait in [("Radial", 2600), ("Orbit", 4200), ("3D", 6000), ("Replay", 9500)]:
            await page.get_by_role("radio", name=variant).click()
            await page.wait_for_timeout(wait)

        # 5. facts, cypher, trace
        for tab, wait in [("Facts", 2000), ("Cypher", 2200), ("Trace", 2200)]:
            await page.get_by_role("tab", name=tab).click()
            await page.wait_for_timeout(wait)

        # 6. follow-up with context, then a comparison question
        await page.get_by_role("button", name="And in Canada?").click()
        await page.wait_for_function("() => document.querySelectorAll('.assistant').length === 2 && !document.querySelector('.assistant.streaming')", timeout=20000)
        await page.wait_for_timeout(2000)
        await slow_type(page, "Compare parental leave in the USA, Mexico and Canada.")
        await page.keyboard.press("Enter")
        await page.wait_for_function("() => document.querySelectorAll('.assistant').length === 3 && !document.querySelector('.assistant.streaming')", timeout=20000)
        await page.wait_for_timeout(1500)
        await page.get_by_role("button", name="Evidence").last.click()
        await page.wait_for_timeout(3200)

        # 7. LLM off → extractive answer
        await page.get_by_role("button", name="LLM answer").click()
        await page.wait_for_timeout(400)
        await slow_type(page, "Who approves sick leave longer than three days in the USA?")
        await page.keyboard.press("Enter")
        await page.wait_for_function("() => document.querySelectorAll('.assistant').length === 4 && !document.querySelector('.assistant.streaming')", timeout=20000)
        await page.wait_for_timeout(2200)
        await page.get_by_role("button", name="LLM answer").click()

        # 8. light theme, sidebar, architecture
        await page.get_by_role("button", name="Toggle theme").click()
        await page.wait_for_timeout(1800)
        await page.get_by_role("button", name="Toggle theme").click()
        await page.wait_for_timeout(600)
        await page.get_by_role("button", name="New conversation").click()
        await page.wait_for_timeout(1400)
        await page.get_by_role("link", name="Architecture").click()
        await page.wait_for_timeout(1500)
        await page.mouse.wheel(0, 700)
        await page.wait_for_timeout(1800)

        video = page.video
        assert video is not None, "video recording was not enabled"
        await ctx.close()
        path = pathlib.Path(await video.path())
        target = DOCS / "tour.webm"
        shutil.move(str(path), str(target))
        shutil.rmtree(TMP, ignore_errors=True)
        await browser.close()
        print("wrote", target)


if __name__ == "__main__":
    asyncio.run(main())
