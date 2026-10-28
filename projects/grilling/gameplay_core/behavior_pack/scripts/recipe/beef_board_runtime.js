// Cookery owns its chopping-board inventory in its own BP property scope.
// Returning false preserves the host's normal beef recipe and does not cancel,
// debit, alter a shared block, or erase legacy Grilling records. A true override
// must wait for a documented host transaction API with a completion receipt.
export function tryScheduleBeefBoardOverride(_event){return false;}
