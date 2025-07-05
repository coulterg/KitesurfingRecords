<script>
	import RadialWaterfall from "./components/RadialWaterfall.svelte";
	import Scrolly from "./components/Scrolly.svelte";
	
	let selectedGender = 'men'

	let step = 0;
	const dummySteps = Array.from({ length: 200})
</script>

<main>
	<h1>Kitesurfing Record Waterfall</h1>

	<fieldset>
		<legend>Show:</legend>

		<label>
			<input
				type="radio"
				name="gender"
				bind:group={selectedGender}
				value="men" />
			Men
		</label>

		<label>
			<input
				type="radio"
				name="gender"
				bind:group={selectedGender}
				value="women" />
			Women
		</label>

	</fieldset>

	<div class='scrolly-plot-wrapper'>
		<Scrolly bind:value={step}>
			{#each dummySteps as _, i}
				<div class='step' class:active={step === i}>
					<p> Reveal month {i+1}</p>
				</div>
			{/each}
			<div class='spacer' />
		</Scrolly>
		<div class='plot-container'>
			<RadialWaterfall gender={selectedGender} {step}/>
		</div>
	</div>

	
</main>

<style>
	main {
		max-width: 800px;
		margin: 2rem auto;
		font-family: system-ui, sans-serif;
		text-align: center;
	}
	h1 {
		margin-bottom: 1.5rem;
	}
	fieldset {
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
	}
	.step {
		padding: 2rem;
		opacity: 0.3;
		transition: opacity 0.2s;
	}
	.step.active {
		opacity: 1;
	}
	.spacer {
		height: 50vh;
	}
	.scrolly-plot-wrapper {
		display: flex;
		gap: 2rem;
		align-items: start;       /* keep chart pinned to top of its column */
		}
	/* stack on mobile */
	@media (max-width: 600px) {
		.scrolly-plot-wrapper {
			flex-direction: column-reverse;
	}
	}
	.plot-container {
		position: sticky;
		top: 2rem;          /* how far from the top of the viewport */
		align-self: start;  /* if its parent is a flex row, keep it at the top */
	}
</style>