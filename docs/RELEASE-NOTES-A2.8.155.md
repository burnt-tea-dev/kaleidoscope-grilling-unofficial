# A2.8.155 source candidate

Combine the Cookery 1.6.2 host adaptation with the concurrent plate and recipe
transaction repair under a fresh paired identity. The two earlier branches both
claimed G154 with different runtime bytes; their commits and history remain
unchanged. G155 uses the exact host source from `7eadfebf370aa3e5927084b8bf2c47272ed006e9`
and imports only the two plate runtime files from
`5a0cf60ae510bc05ee49eb7178aa975a1be59487`.

Failed plate transfers restore an input only while its complete captured
ownership can still be established. Unknown credits, foreign metadata, blocks,
receipts or unreadable state retain the existing persistent recovery boundary
and block retries. Book recording and Cookery recipe conversion pin the captured
hand slot and use the same owned item transaction path. A native setter throwing
after a confirmed restoration no longer creates a false rollback failure.

The public Cookery API remains 0.2.13, including the reviewed oil placement and
seven-powder millstone adapters. Guide 0.3.66 uses transfer revision
`kg-guide-a3-28155`; both pack descriptions now correctly name Cookery 1.6.2.
The new sealed source layer recovers the exact host154 layer
before its existing G153 and historical checks; old ledgers are not rewritten.

Targeted fault-injection cases reproduce an earlier input refund while a later
credit remains unknown, and the repaired production functions reject that
unsafe refund. These API-model checks do not establish native failure frequency
or rendered gameplay. Full canonical CI, complete-family BDS/saved-world gates
and human client acceptance remain required. No new public download or LIVE
deployment is claimed here. `client=false`, `production_ready=false`.
