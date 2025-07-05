<script>
	import RadialWaterfall from "./components/RadialWaterfall.svelte";
	
	let selectedGender = 'men'
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

  <RadialWaterfall gender={selectedGender}/>
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
</style>