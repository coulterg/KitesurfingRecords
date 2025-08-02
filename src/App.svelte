<script>
	import { onMount } from 'svelte';
	import { csv } from 'd3-fetch';
	import { timeParse, timeFormat } from 'd3-time-format';
	import { timeMonths } from 'd3-time';

	import RadialWaterfall from "./components/RadialWaterfall.svelte";
	import Scrolly from "./components/Scrolly.svelte";

	import { annotationMap } from './lib/data/annotations.js'
	import CurrentInfo from './components/CurrentInfo.svelte';
	
	let gender = 'men'
	let step = 0;

	// let currentEntry = [];
	// let currentRec = [];
	
	// Parsing and storing data
	let raw = []
	onMount(async () => {
		raw = await csv('data/records.csv', row => ({
			date: 	timeParse('%m/%d/%y')(row.Date_US),
			name: 	row.Name,
			height: +row.Height_m,
			gender: row.Gender,
			kiteBrand: row.kite_brand || 'null',
			kiteModel: row.kite_model || 'null',
			kiteSize: +row.kite_size || 'null',
			country: row.loaction_country || 'null',
			location: row.location || 'null',
			annotation: 'null'
		}));
		console.log(raw)
		buildEntries()
		console.log(entries)
	});

	const fmtMonth = timeFormat('%b %Y');
	let entries = []
	function buildEntries() {
		raw.sort((a,b)=>a.date-b.date);

		const[start, end] = [raw[0].date, raw.at(-1).date];
		const months = timeMonths(
			new Date(start.getFullYear(), start.getMonth(), 1),
			new Date(end.getFullYear(), end.getMonth() + 1, 1)
		);

		let lastMenH = 0;
		let lastWomenH = 0;

		entries = months.map(date => {
			// find the raw record object for this month (if any)
			const menRec   = raw.find(r =>
				r.gender==='male'   &&
				r.date.getFullYear()===date.getFullYear() &&
				r.date.getMonth()   ===date.getMonth()
			);
			const womenRec = raw.find(r =>
				r.gender==='female' &&
				r.date.getFullYear()===date.getFullYear() &&
				r.date.getMonth()   ===date.getMonth()
			);

			const menH   = menRec   ? menRec.height   : lastMenH;
			const womenH = womenRec ? womenRec.height : lastWomenH;

			const menPrev   = lastMenH;
    		const womenPrev = lastWomenH;

			if (menRec   && menH   > lastMenH)   lastMenH   = menH;
			if (womenRec && womenH > lastWomenH) lastWomenH = womenH;

			// get annotations
			const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}`
			const { men = '', women = '' } = annotationMap[key] || {};

			console.log(key, annotationMap[key])


			return {
				date,
				label:     fmtMonth(date),
				menH,
				menPrev,
				womenH,
				womenPrev,
				// *** carry the whole record object ***
				menRec,      // undefined if no record this month
				womenRec,    // likewise
				// annotations or other fields you like
				menAnnotation:   men,
				womenAnnotation: women
			};
		});
	}

	$: currentEntry = entries[step] || null;
	$: currentRec = (
		entries
			.slice(0, step+1)                      // take all up to and including the current step
			.reverse()                              // search backwards
			.find	(e => e[gender + 'Rec'])           // find first entry that has a record
	)?.[gender + 'Rec'] || null;
</script>

<main>
	<section class='hero'>
		<h1>
			<span class='title-main'>Reaching New Heights</span>
			<span class='title-sub'>The evolution of kitesurfing jump records</span>
		</h1>
	</section>
	<section class='intro-section' aria-label='Introduction'>
		<p class='intro-text'>Picture yourself on the upper level of a 2-storey house, looking out the window - a height 
			most of us instinctively understand.
			<br><br>
			Now, if that already feels a little lofty, stretch your imagination to the rooftop of a 12-storey building. 
			Think typical city-centre, mid-rise apartment block, and you're in the right ball-park. Gazing out,
			almost <b>40 meters</b> (or <b>130 feet</b>), above the ground.
			<br><br>
			Really picture it - at that kind of height, someone's head would be far smaller than the nail on your pinky finger, held out at arms length.
			<br><br>
			A little <i>spine-chilling</i>, no?
			<br><br>
			That's the kind of scale elite kitesurfers reach these days, launching themselves skywards
			from the sea, up and over 12-storeys, and back down to safety. Over, and over again.
			<br><br>
			How did we get to such unimaginable heights?			
		</p>
	</section>
	<section aria-labelledby="record-progression">
		{#if entries.length}
			<div class='scrolly-plot-wrapper'>
				<div class='steps-container'>
					<Scrolly bind:value={step}>
						{#each entries as e, i}
							<div class='step' class:active={step === i} class:has-annotation={gender === 'men' ? e.menAnnotation : e.womenAnnotation}>
								{#if (gender === 'men' ? e.menAnnotation : e.womenAnnotation)}
									<div class='step-content'>
										{gender === 'men' ? e.menAnnotation : e.womenAnnotation}
									</div>
								{/if}
							</div>
						{/each}
						<div class='spacer' />
						<div class='spacer' />	
					</Scrolly>
				</div>
				<!-- <div class='spacer' /> -->
				<div class='plot-container'>
					<h2 id='record-progression'>World Record Progression</h2>
					<div role='group' aria-label='Select gender' class='gender-toggle'>
						<button
							type='button'
							aria-pressed={gender === 'men'}
							on:click={() => gender = 'men'}
						>
							Men
						</button>
						<span>|</span>
						<button
							type='button'
							aria-pressed={gender === 'women'}
							on:click={() => gender = 'women'}
							>
							Women
						</button>
					</div>
					<div class='month-label'>
						{currentEntry?.label ?? 'Dec 2013'}
					</div>
					<div class='radial-plot'>
						<div class='plot-clip'>
							<RadialWaterfall 
								entries={entries}
								step={step ?? 0}
								gender={gender}/>	
						</div>
					</div>
					<CurrentInfo
							monthLabel = {currentEntry?.label}
							record = {currentRec}
						/>
				</div>
			</div>
		{:else}
			<p>Loading data…</p>
		{/if}
	</section>

	<div class='spacer' />
	<div class='spacer' />
</main>

<style>
	:global(html, body) {
		height: 100%;
		margin: 0;

		font-family: 'Inter', sans-serif;
		font-optical-sizing: auto;
		font-weight: 300;
		line-height: 1.6;
		color: var(--color-text-1);
		background: var(--bg-gradient) no-repeat center center fixed;
		background-size: cover;
	}

	main {
		width: 90vw;
		max-width: 1600px;
		margin: 2rem auto;
		text-align: left;
	}

	h1 {
		font-family: 'Merriweather', serif;
		font-weight: 350;
		font-size: clamp(2.2rem, 4vw + 1rem, 3rem);
		line-height: 1.2;
		margin-bottom: 1.5rem;
		text-align: center;
		color: var(--color-text-1);
	}

	h2 {
		/* display: flex; */
		margin-block-end: 0.1rem;
		font-family: 'Merriweather', serif;
		font-weight: 310;
		font-size: clamp(1.8rem, 2vw + 0.5rem, 2rem);
		/* line-height: 1.3; */
		/* margin-bottom: 1.2rem; */
		color: var(--color-text-1);
		/* text-align: center; */
	}

	h3 {
		font-family: 'Merriweather', serif;
		font-weight: 300;
		font-size: clamp(1.3rem, 1.2vw + 0.5rem, 1.8rem);
		line-height: 1.4;
		margin-bottom: 1rem;
		/* text-align: center; */
	}

	h4 {
		font-family: 'Merriweather', serif;
		font-weight: 300;
		font-size: clamp(1.1rem, 1vw + 0.4rem, 1.4rem);
		line-height: 1.5;
		margin-bottom: 0.8rem;
		/* text-align: center; */
	}

	/* fieldset {
		border: none;
		margin-bottom: 1.5rem;
		display: flex;
		justify-content: center;
		gap: 1.5rem;
	}
	label {
		font-size: 1rem;
		cursor: pointer;
	}
	input[type="radio"] {
		margin-right: 0.3rem;
	} */

	.hero {
		display: flex;              /* or grid with place-items:center */
		flex-direction: column;
		justify-content: center;
		align-items: center;
		height: 90vh;
		margin-left: 20vw;
		margin-right: 20vw;
		padding: 0 1rem;
		text-align: center;
	}

	.title-main {
		display: block;
		font-size: clamp(2.5rem, 5vw + 1rem, 3rem);
		font-weight: 300;
		font-family: 'Merriweather', serif;
		/* line-height: 1.1; */
		margin-bottom: 1.5rem;
		text-align: left;
		/* margin: 0; */
	}

	.title-sub {
		display: block;
		font-size: clamp(1.8rem, 2vw + .75rem, 2.4rem);
		font-weight: 200;
		font-family: 'Inter', sans-serif;
		/* line-height: 1.1; */
		margin-top: 0.5rem;
		margin: 0;
		letter-spacing: 0.08em;
		text-align: right;
		color: var(--color-text-2)
	}

	.intro-section {
		height: auto;
		margin: auto;
		margin-bottom: 150px;
		max-width: 650px;
	}
	.intro-text {
		font-size: 20px;
		line-height: 32px;
	}
	
	.gender-toggle button {
		display: inline-flex;
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		margin-right: 0.4rem;
		font: inherit;         /* use the same font-size / weight */
		color: inherit;        /* same text color */
		cursor: pointer;
		font-size: 1.3rem;
		opacity: 0.3;       /* show pointer on hover */
	}

	.gender-toggle button:last-child {
		margin-right: 0;
		margin-left: 0.4rem;
	}
	
	.gender-toggle button[aria-pressed="true"] {
		opacity: 1;
		transition: opacity 0.3s ease;
	}

	.month-label{
		font-size: 1.2rem;
		color: var(--color-text-2);
		opacity: 0.75;
	}

	.step {
		height: 15vh;  /* Small height for empty steps */
		opacity: 0.3;
		display: flex;
		place-items: center;
		justify-content: center;
		align-items: center;
		padding: 1rem;
		transition: all 0.3s ease;
		margin: 0;  /* Reset any margins */
	}

	.step.has-annotation {
		height: 50vh;  /* Changed from 100vh to 50vh */
		margin: 25vh 0 0;  
		/* Add vertical margins to center and create space */
	}

	.step.has-annotation.active {
		/* height: 60vh;  Full height only for active steps with annotations */
		opacity: 1;
	}

	.step-content {
		font-size: 1rem;
		background: var(--color-bg-2);
		color: var(--color-text-1);
		border-radius: 5px;
		padding: .5rem 1rem;
		display: flex;
		flex-direction: column;
		justify-content: center;
		transition: background 500ms ease, color 500ms ease;
		box-shadow: 1px 1px 10px rgba(0,0,0,.2);
		text-align: left;
		width: 75%;
		margin: auto;
		/* max-width: 500px; */
		/* position: sticky;   */
		top: 50vh;         /* Position in middle of viewport */
		transform: translateY(-50%);  /* Center vertically */
	}

	.step.active .step-content {
		opacity: 1;
	}
	.spacer {
		height: 50vh;
		/* width: 90vw; */
		/* max-width:1000px; */
		display: flex;
		align-items: center;
	}
	.scrolly-plot-wrapper {
		width: 100%; /* fill parent container (the viewport) */
		max-width: 3000px; /* but not wider than 1600 */
		margin: 0 auto;
		
		display: grid;
		/* justify-content: center; */
		grid-template-columns: 
			minmax(0, 0.5fr) 
			repeat(8, minmax(0, 2fr)) 
			minmax( 0, 0.5fr);
		gap: 2rem;
		}

	.steps-container {
		grid-column: 2 / 5;
	}
	.plot-container {
		grid-column: 5 / 10;
		position: sticky;
		align-self: start;
		top: 0;
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: 
			auto /* h2 */
			auto /* toggle gender */
			auto /* year month */
			1fr /* plot */
			auto; /* metadata */
		height: 100vh;
		row-gap: 0rem;
		/* position: relative; */
		/* outline: 2px dashed hotpink;     temporary debug outline */

	}

	.plot-container > h2 {
		grid-row: 1;
		grid-column: 1;
		justify-self: start;
		z-index: 2;
		position: relative;

	}

	.plot-container > .gender-toggle {
		grid-row: 2;
		grid-column: 1;
		justify-self: start;
		z-index: 2;
		position: relative;
	}

	.plot-container > .month-label {
		grid-row: 3;
		grid-column: 1;
		justify-self: start;
		z-index: 2;
		position: relative;
	}

	.plot-container > .radial-plot {
		grid-row: 3 / 6;
		grid-column: 1;
		justify-self: center;
		align-items: center;
		position: relative;
		z-index: 1;
		margin: 0;
	}

	.radial-plot {
		/* /* text-align: center; */
		align-self: center;
		/* max-width: 80%; */
		width: clamp(650px, 85%, 90%);
		margin: 0 auto;
  }

	.plot-container > .current-info {
		grid-row: 5;
		grid-column: 1;
		justify-self: start;
		z-index: 2;	
		position: relative;
	}

	*, *::before, *::after {
		box-sizing: border-box;
		}

	/* stack on mobile */
	@media (max-width: 900px) {
		main {
			width: 97vw;
			margin: 0;
		}
		.intro-section {
			margin: 5vw auto;
			width: clamp(70vw, 85vw, 650px);

			display: flex;             
			flex-direction: column;
			justify-content: center;
			align-items: center;
		}
		.scrolly-plot-wrapper {
			display: flex;
			flex-direction: column-reverse;
			width: 97vw;
    		box-sizing: border-box;
			justify-content: center;
			align-items: center;
		}
		.plot-container {
			justify-content: center;
			margin: 0;
			width: 100%;
			height: 100%;
		}
		.plot-container > h2 {
			margin-left: 4vw;
		}
		.plot-container > .gender-toggle {
			position: relative;
			margin-left: 4vw;
			z-index: 11;
		}
		.plot-container > .month-label {
			margin-left: 4vw;
		}
		.plot-container > .radial-plot {
			/* width:                   clamp(550px, 650px, 650px); */
			width: 100%;
			overflow-x: hidden;
			overflow-y: visible;
			align-items: center;
			justify-content: center;
		}
		/* Clip & center the real chart inside a fixed box */
		.plot-clip {
			width: 650px;
			min-width: 650px;
			max-width: none;    /* so it can shrink if seriously needed */
			margin: 0 auto;     /* center it in the 100% container */
			overflow-x: hidden; /* hide the extra bits */
			position: relative;
			left: 50%;
			transform: translateX(-50%);
		}

		/* If you can target the <svg> itself, ensure it matches */
		.plot-clip :global(svg) {
			display: block;
			width: 650px;
			max-width: none; 
		}
		.plot-container :global(.current-info > .info-left) {
			margin-left: 4vw;
			margin-bottom: 4vw;
		}
		.plot-container :global(.current-info > .info-right) {
			margin-right: 4vw;
			margin-bottom: 4vw;
		}
		.steps-container {
			display: block;
			/* align-self: center; */
			/* width: 90vw; */
			justify-content: center;
			align-items: center;
			margin:  5vw auto;
			position: relative;
			z-index: 8;
		}

	}

	.current-month {
		font-size: 1.25rem;
		font-weight: bold;
		margin-bottom: 0.5rem; /* space between label and chart */
		text-align: left;
	}
	
</style>