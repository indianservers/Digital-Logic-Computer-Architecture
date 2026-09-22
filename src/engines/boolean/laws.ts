export interface LawDemo {
  id: string;
  name: string;
  pair: [string, string];
  note: string;
  variables: string[];
}

export const BOOLEAN_LAWS: LawDemo[] = [
  { id: "identity", name: "Identity", pair: ["A + 0", "A"], note: "OR with 0 leaves the value unchanged. AND with 1 does the same.", variables: ["A"] },
  { id: "identity-and", name: "Identity", pair: ["A · 1", "A"], note: "AND with 1 is a no-op.", variables: ["A"] },
  { id: "null", name: "Null", pair: ["A + 1", "1"], note: "OR with 1 forces the result high.", variables: ["A"] },
  { id: "null-and", name: "Null", pair: ["A · 0", "0"], note: "AND with 0 forces the result low.", variables: ["A"] },
  { id: "idempotent", name: "Idempotent", pair: ["A + A", "A"], note: "Repeating a variable does not add information.", variables: ["A"] },
  { id: "complement", name: "Complement", pair: ["A + A'", "1"], note: "A variable and its complement cover every case.", variables: ["A"] },
  { id: "complement-and", name: "Complement", pair: ["A · A'", "0"], note: "A variable cannot be true and false together.", variables: ["A"] },
  { id: "involution", name: "Involution", pair: ["(A')'", "A"], note: "Negating twice returns the original value.", variables: ["A"] },
  { id: "commutative", name: "Commutative", pair: ["A + B", "B + A"], note: "Order does not matter for OR or AND.", variables: ["A", "B"] },
  { id: "associative", name: "Associative", pair: ["(A + B) + C", "A + (B + C)"], note: "Grouping does not change a chain of the same operator.", variables: ["A", "B", "C"] },
  { id: "distributive", name: "Distributive", pair: ["A · (B + C)", "A·B + A·C"], note: "AND distributes over OR, just as multiplication distributes over addition.", variables: ["A", "B", "C"] },
  { id: "absorption", name: "Absorption", pair: ["A + A·B", "A"], note: "The extra product is already covered by A.", variables: ["A", "B"] },
  { id: "demorgan", name: "De Morgan", pair: ["(A · B)'", "A' + B'"], note: "A NAND is an OR of the inverted inputs.", variables: ["A", "B"] },
  { id: "demorgan-or", name: "De Morgan", pair: ["(A + B)'", "A' · B'"], note: "A NOR is an AND of the inverted inputs.", variables: ["A", "B"] },
  { id: "duality", name: "Duality", pair: ["A + 0", "A · 1"], note: "Swap OR/AND and 0/1. The dual of a valid identity is also valid.", variables: ["A"] },
];
