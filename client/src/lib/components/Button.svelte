<script lang="ts">
    let props = $props();

</script>

<button class={["border-2 px-2 uppercase font-mono text-sm font-bold hover:cursor-pointer disabled:bg-gray-400 disabled:cursor-default", props.class, props.width]}
    disabled={props.disabled}
    onclick={props.onclick} >
    {@render props.children?.()}
</button>