up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f backend frontend

clean:
	docker compose down -v
