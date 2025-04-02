<script>
  export let isLoading = false;
</script>

<style>
  .dot {
    animation: blink 1.5s infinite;
  }
  .dot:nth-child(2) {
    animation-delay: 0.3s;
  }
  .dot:nth-child(3) {
    animation-delay: 0.6s;
  }

  @keyframes blink {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
</style>

{#if isLoading}
  <div class="flex">
    <span class="dot">.</span>
    <span class="dot">.</span>
    <span class="dot">.</span>
  </div>
{/if} 