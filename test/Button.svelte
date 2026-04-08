<!-- © 2024 Oscar Knap - Alle rechten voorbehouden -->

<script>
    import christmasCandyCane from "$lib/images/christmas-candy-cane.png";
    import christmasCandyCaneWebp from "$lib/images/christmas-candy-cane.webp";

    import { theme } from "$lib/theme";

    let a = $state(0.8);

    let {
        disabled = false,
        loading = $bindable(false),
        danger = false,
        fullWidth = false,
        click = null,
        children,
    } = $props();
</script>

<button
    disabled={disabled || loading}
    class:disabled
    class:loading
    class:danger
    class:fullWidth
    type="button"
    onclick={async () => {
        if (disabled || loading) {
            console.warn("Button clicked when disabled or loading");
            return;
        }

        loading = true;
        try {
            if (click) await click();
        } finally {
            loading = false;
        }
    }}
>
    {@render children?.()}
    {#if $theme.elements === "halloween"}
        {[
            "🎃",
            "👻",
            "🕷️",
            "🕸️",
            "🧛",
            "🧙‍♀️",
            "🧟‍♂️",
            "🧟‍♀️",
            "💀",
            "🦇",
            "🍬",
            "🍭",
        ][Math.floor(Math.random() * 12)]}
    {:else if $theme.elements === "christmas"}
        <picture>
            <source srcset={christmasCandyCaneWebp} type="image/webp" />
            <source srcset={christmasCandyCane} type="image/png" />
            <img
                src={christmasCandyCane}
                alt="Kerst zuurstok"
                width="30px"
                height="30px"
            />
        </picture>
    {/if}
</button>

<style>
    button {
        background-color: var(--color-main);
        color: white;

        opacity: js(a / 2);

        padding: 10px 13px;
        border-radius: 8px;

        font-size: 17px;

        display: flex;
        justify-content: center;
        align-items: center;
    }

    button.fullWidth {
        width: 100%;
    }

    button:disabled.loading {
        background-color: var(--color-main-lighter);
        cursor: wait;
    }

    button:disabled.disabled {
        background-color: var(--color-main-lighter);
        cursor: not-allowed;
    }

    button.danger {
        background-color: red;
    }

    button:disabled.loading.danger {
        background-color: rgb(255, 125, 125);
    }

    button:disabled.disabled.danger {
        background-color: rgb(255, 125, 125);
    }
</style>
