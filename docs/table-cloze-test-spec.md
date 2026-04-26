# Table Cloze Test Spec

## Purpose

Define the test matrix for markdown table support in `transformMarkdownToCloze` and `markdownToHtml`.

This document is intentionally test-first. It fixes the expected behavior before implementation lands.

## Assumed V1 Contract

- Parse markdown tables as GFM tables in both the cloze and HTML pipelines.
- Generate clozes across table data cells rather than using delimiter parsing inside cells.
- Only table body rows participate in cloze generation.
- Header rows never generate clozes.
- Treat the first body column as the row-header column for V1 test purposes.
- Every non-empty body cell outside the row-header column becomes its own cloze deletion.
- Each eligible data cell consumes exactly one cloze index.
- `includePromptCloze` has no additional effect on table behavior in V1 because there is no separate prompt-side table cell contract.
- Rows with only a row-header cell and no data cells do not generate any clozes.
- Cloze numbering is global and monotonic across lists, code blocks, and tables.
- Inline markdown already supported elsewhere should remain supported inside table cells.
- V1 does not introduce table-only delimiter syntax.
- V1 does not attempt multiline or block-level table-cell semantics beyond normal GFM table parsing.

## Test Groups

### 1. Parsing And Rendering

1. `parses_a_basic_two_column_table_as_a_table`
   Input:
   ```md
   | Prompt | Answer |
   | - | - |
   | TCP handshake | synchronize |
   ```
   Expectation:
   - cloze transform recognizes table structure instead of leaving the block as plain paragraph text
   - HTML transform renders `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, and `<td>`

2. `preserves_alignment_markers_when_round_tripping_markdown`
   Input uses left, center, and right alignment markers.
   Expectation:
   - table remains a valid markdown table after cloze transform
   - alignment row is not dropped or collapsed

3. `renders_escaped_pipes_inside_cells_correctly`
   Input contains escaped pipes such as `a \\| b`.
   Expectation:
   - escaped pipes remain part of cell content
   - cell splitting is based on parsed table structure, not raw string splitting

4. `treats_non_table_pipe_text_as_non_table_content`
   Input contains pipe-heavy prose that does not form a valid GFM table.
   Expectation:
   - no table-specific cloze logic runs
   - output remains non-table content

### 2. Core Horizontal Cloze Behavior

5. `clozes_the_first_data_cell_in_a_basic_two_column_body_row`
   Input:
   ```md
   | Prompt | Answer |
   | - | - |
   | TCP handshake | synchronize |
   ```
   Expected cloze markdown:
   ```md
   | Prompt | Answer |
   | - | - |
   | TCP handshake | {{c1:: synchronize }} |
   ```

6. `assigns_one_cloze_index_per_eligible_data_cell`
   Input:
   ```md
   | Topic | A | B |
   | - | - | - |
   | TCP handshake | synchronize | ACK |
   ```
   Expectation:
   - `synchronize` uses `c1`
   - `ACK` uses `c2`

7. `clozes_all_non_header_data_cells_in_three_column_rows`
   Input:
   ```md
   | Topic | Hint | Answer |
   | - | - | - |
   | TCP handshake | SYN packet | synchronize |
   ```
   Expected cloze markdown:
   ```md
   | Topic | Hint | Answer |
   | - | - | - |
   | TCP handshake | {{c1:: SYN packet }} | {{c2:: synchronize }} |
   ```

8. `clozes_every_data_cell_in_wider_rows`
   Input:
   ```md
   | A | B | C | D |
   | - | - | - | - |
   | one | two | three | four |
   ```
   Expectation:
   - `one` remains the row header
   - `two`, `three`, and `four` are clozed as `c1`, `c2`, and `c3`

9. `preserves_empty_and_whitespace_behavior_for_individual_data_cells`
   Input contains leading or trailing spaces inside cells.
   Expectation:
   - cloze wrappers are inserted consistently
   - meaningful content spacing inside the cell is preserved as closely as existing transform rules allow

10. `does_not_generate_cloze_for_header_rows`
    Expectation:
    - the header row is untouched even if it looks contentful

### 3. Prompt Cloze Option

11. `ignores_include_prompt_cloze_for_table_cells_in_v1`
    Expectation:
    - enabling `includePromptCloze: true` does not change table-cell output shape
    - table data cells still use ordinary answer-side cloze wrappers

12. `keeps_numbering_monotonic_when_include_prompt_cloze_is_enabled_for_non_table_content`
    Input mixes list-item clozes, table clozes, and code-block clozes.
    Expectation:
    - numbering continues monotonically through all structures

### 4. Non-Transform And Skip Cases

13. `skips_empty_data_cells_without_consuming_a_cloze_index`
    Input:
    ```md
    | Topic | A | B |
    | - | - | - |
    | TCP handshake | | ACK |
    ```
    Expectation:
    - empty data cell stays empty
    - `ACK` still becomes the next cloze
    - no cloze index is consumed for the empty cell

14. `skips_rows_with_only_a_row_header_cell`
    Input:
    ```md
    | Topic | A | B |
    | - | - | - |
    | only prompt | | |
    ```
    Expectation:
    - row remains unchanged
    - no clozes are generated for the row

15. `skips_completely_empty_body_rows`
    Expectation:
    - empty rows remain empty
    - no cloze index is consumed

16. `does_not_double_wrap_existing_cloze_markup_inside_data_cells`
    Input contains `{{c1:: existing }}` inside an answer cell.
    Expectation:
    - existing cloze markup is preserved
    - transform does not nest a second cloze around that cell

17. `leaves_tables_without_any_eligible_data_cells_structurally_intact`
    Expectation:
    - markdown output is still a valid table
    - HTML output is still a real table

### 5. Inline Content Inside Cells

18. `supports_inline_code_in_data_cells`
    Input:
    ```md
    | Prompt | Answer |
    | - | - |
    | HTTP code | `404` |
    ```
    Expectation:
    - inline code survives
    - data cell becomes a cloze

19. `supports_math_in_data_cells`
    Expectation:
    - inline math remains intact
    - data cell becomes a cloze when eligible

20. `supports_obsidian_wikilinks_in_row_header_cells`
    Expectation:
    - wikilinks remain structured nodes
    - row-header cell remains untouched

21. `supports_obsidian_wikilinks_in_data_cells`
    Expectation:
    - data cell can be clozed while keeping the wikilink content intact

22. `does_not_require_dash_or_equals_delimiters_inside_data_cells`
    Expectation:
    - row-wise table cloze is based on cell position, not inner punctuation

### 6. Mixed-Document Numbering And Stability

23. `keeps_numbering_monotonic_across_list_items_tables_and_code_blocks`
    Input order:
    - list item cloze
    - multiple table data-cell clozes
    - code block cloze
    - second table data-cell cloze
    Expectation:
    - numbering increments exactly once per generated data cell or existing generated unit

24. `supports_multiple_tables_in_a_single_note`
    Expectation:
    - numbering continues across tables
    - earlier tables do not reset later ones

25. `preserves_surrounding_headings_paragraphs_and_lists_around_tables`
    Expectation:
    - enabling table support does not regress existing spacing and join behavior around root-level nodes

26. `maintains_table_structure_when_only_some_cells_are_eligible`
    Expectation:
    - transformed and untouched cells coexist in the same table without structural corruption

### 7. HTML Output Assertions

27. `renders_clozed_tables_as_html_tables_not_paragraphs`
    Expectation:
    - HTML output contains `<table>`
    - cloze markup remains in cell text content for Anki

28. `renders_header_and_body_cells_with_correct_semantic_tags`
    Expectation:
    - header cells render as `<th>`
    - body cells render as `<td>`

29. `renders_inline_obsidian_links_inside_table_cells_as_anchor_tags`
    Expectation:
    - table HTML contains anchor tags with Obsidian deep links inside cells

30. `renders_inline_math_inside_table_cells_without_breaking_table_markup`
    Expectation:
    - KaTeX-compatible math text survives inside cell output

## Representative End-To-End Cases

### Case A: Basic Two-Column Table

Input:
```md
| Prompt | Answer |
| - | - |
| TCP handshake | synchronize |
| HTTP 404 | not found |
```

Expected cloze markdown:
```md
| Prompt | Answer |
| - | - |
| TCP handshake | {{c1:: synchronize }} |
| HTTP 404 | {{c2:: not found }} |
```

### Case B: Mixed Note With Lists, Table, And Code Block

Input:
```md
# Card
- Prompt - answer

| Topic | A | B |
| - | - | - |
| TCP handshake | SYN | ACK |

```py
# reveal
line1
```
```

Expected cloze numbering:
- list item answer => `c1`
- first table data cell => `c2`
- second table data cell => `c3`
- code block line => `c4`

### Case C: Full Data-Region Cloze Across A Wide Row

Input:
```md
| Topic | Hint | Answer |
| - | - | - |
| TCP handshake | SYN packet | synchronize |
```

Expected cloze markdown:
- `Topic` body cell remains the row header
- `Hint` becomes `{{c1:: SYN packet }}`
- `Answer` becomes `{{c2:: synchronize }}`

## Explicit Open Questions To Resolve Before Implementation

- Whether the first body column should always be treated as the row-header column, or only when the user has clearly authored a row-header table.
- Whether whitespace-only data cells should be treated as empty and skipped.
- Whether existing cloze markup inside a table row should make only that cell ineligible or should make the whole row ineligible.
- Whether malformed GFM tables should remain byte-stable or only semantically stable after parse/stringify.
