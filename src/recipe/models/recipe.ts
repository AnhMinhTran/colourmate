import { randomUUID } from "expo-crypto";

export interface RecipeStepColourProps {
    id: string;
    step_id: string;
    colour_id: string;
    position: number;
}

export interface RecipeStepProps {
    id: string;
    recipe_id: string;
    position: number;
    comment: string | null;
    image_uri: string | null;
    colours: RecipeStepColourProps[];
}

export interface RecipeProps {
    id: string;
    name: string;
    created_at: number;
    steps: RecipeStepProps[];
}

export class RecipeStepColour {
    readonly id: string;
    readonly step_id: string;
    readonly colour_id: string;
    position: number;

    private constructor(props: RecipeStepColourProps) {
        this.id = props.id;
        this.step_id = props.step_id;
        this.colour_id = props.colour_id;
        this.position = props.position;
    }

    static create(step_id: string, colour_id: string, position: number): RecipeStepColour {
        return new RecipeStepColour({ id: randomUUID(), step_id, colour_id, position });
    }

    static fromDatabase(props: RecipeStepColourProps): RecipeStepColour {
        return new RecipeStepColour(props);
    }
}

export class RecipeStep {
    readonly id: string;
    readonly recipe_id: string;
    position: number;
    comment: string | null;
    image_uri: string | null;
    colours: RecipeStepColour[];

    private constructor(props: RecipeStepProps) {
        this.id = props.id;
        this.recipe_id = props.recipe_id;
        this.position = props.position;
        this.comment = props.comment;
        this.image_uri = props.image_uri;
        this.colours = props.colours.map(RecipeStepColour.fromDatabase);
    }

    static create(recipe_id: string, position: number): RecipeStep {
        return new RecipeStep({ id: randomUUID(), recipe_id, position, comment: null, image_uri: null, colours: [] });
    }

    static fromDatabase(props: RecipeStepProps): RecipeStep {
        return new RecipeStep(props);
    }
}

export class Recipe {
    readonly id: string;
    name: string;
    readonly created_at: number;
    steps: RecipeStep[];

    private constructor(props: RecipeProps) {
        this.id = props.id;
        this.name = props.name;
        this.created_at = props.created_at;
        this.steps = props.steps.map(RecipeStep.fromDatabase);
    }

    static create(name: string): Recipe {
        return new Recipe({ id: randomUUID(), name, created_at: Date.now(), steps: [] });
    }

    static fromDatabase(props: RecipeProps): Recipe {
        return new Recipe(props);
    }
}
